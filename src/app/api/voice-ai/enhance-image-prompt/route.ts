import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Proxies to the same Voice AI /getResponse endpoint as DMs, but with a payload
 * tailored for rewriting image-generation drafts (not a conversational message).
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: creatorAccess, error: creatorAccessError } = await supabase
      .from('creators')
      .select('can_img_gen')
      .eq('profile_id', session.user.id)
      .maybeSingle();

    if (creatorAccessError || !creatorAccess?.can_img_gen) {
      return NextResponse.json({ error: 'Image generation is not enabled for your account.' }, { status: 403 });
    }

    let body: { draft?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const draft = typeof body.draft === 'string' ? body.draft.trim() : '';
    if (!draft) {
      return NextResponse.json({ error: 'Draft prompt is required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_VOICE_AI_BASE_URL?.trim();
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Voice AI base URL not configured' },
        { status: 500 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', session.user.id)
      .maybeSingle();

    const { data: prefixRow } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'prompt_prefix')
      .maybeSingle();

    const promptPrefix = prefixRow?.value ?? '';
    const userName = profile?.full_name || profile?.username || '';

//     const creatorPrompt = `You write image captions in the style of detailed CLIP-style training captions: long, literal, visually exhaustive prose that describes exactly what would be visible in a single photograph—as if you were labeling the image for a vision–language dataset.

// Output format:
// - One continuous caption: one or more dense paragraphs of plain text. No title, no bullet points, no numbered lists, no "Here is the caption:", no quotation marks wrapping the entire output, no explanation before or after.

// What to describe (be specific and concrete):
// - The main subject: body pose, limb and hand positions, gesture, clothing (garments, colors, fit, fabric, accessories), hair, and facial expression (mouth, eyes, brow, gaze direction). A separate reference image supplies identity—do not invent a new person or celebrity; refer in neutral terms ("the person", "they") where needed, but richly describe pose, expression, and styling the user implied.
// - Foreground, midground, and background: objects, surfaces, architecture, vehicles, vegetation, crowds, signage.
// - Place and context: real-world setting type (e.g. city bus interior, beach boardwalk), time of day, weather if visible.
// - Light and color: direction and quality of light, shadows, highlights, color temperature, atmosphere (haze, dust, rain on glass).
// - Camera and medium: framing and crop, approximate lens feel (e.g. phone front-camera wide angle, slight face distortion), distance to subject, depth of field, motion blur, noise/grain, HDR or phone-processing look if relevant.

// Style of writing:
// - Favor observational, literal wording over marketing or poetic filler. Use spatial language (left, right, behind, in the distance, filling the frame).
// - Preserve the user's intent, scenario, and level of explicitness from their draft; expand only by adding plausible visible detail that fits that scenario—do not sanitize what they asked for, and do not add unrelated elements.`;

    const creatorPrompt = `You write image captions in the style of detailed CLIP-style training captions: long, literal, visually exhaustive prose that describes exactly what would be visible in a single photograph—as if you were labeling the image for a vision–language dataset.

    Output format:
    - One continuous caption: one or more dense paragraphs of plain text. No title, no bullet points, no numbered lists, no "Here is the caption:", no quotation marks wrapping the entire output, no explanation before or after.

    Reference image (critical):
    - A separate reference image supplies the person's face, hair, skin, age presentation, and body—the model must match that source. Your caption must NOT invent or add identity-linked traits that are not explicitly stated in the user's DRAFT.
    - Do NOT add or elaborate: hair color, hair length, hair style, texture, facial features, eye color, skin tone, ethnicity, age beyond what the draft literally says, or body shape—unless those exact details appear in the DRAFT (copy them; do not embellish).
    - You MAY describe for the subject: pose, limb and hand positions, gestures, what they hold or interact with, gaze direction in vague terms (e.g. "looking toward the window"), mouth/eyes in terms of action (e.g. "sipping from the cup", "eyes relaxed") without inventing new physical attributes.
    - Prefer "the person" or the role the draft gives (e.g. "woman") over piling on new adjectives about their appearance.

    Scene and camera (expand freely):
    - Foreground, midground, and background: objects, surfaces, architecture, vehicles, vegetation, crowds, signage.
    - Place and context: real-world setting type (e.g., city bus interior, beach boardwalk), time of day, weather if visible.
    - Light and color: direction and quality of light, shadows, highlights, color temperature, atmosphere (haze, dust, rain on glass).
    - Camera and medium: framing and crop, approximate lens feel (e.g., phone front-camera wide angle, slight face distortion), distance to subject, depth of field, motion blur, noise/grain, HDR or phone-processing look if relevant. If the image is a selfie, just say that it's a selfie, don't describe the camera or lens being in the photo. If its a snapchat photo, and a caption is unspecified, just say its a snapchat photo and provide a very short 1 or 2 word caption if not provided.

    Model-Specific Vocabulary & Explicitness Guidelines:
    - Preserve the user's intent, scenario, and level of explicitness from their draft; expand only by adding plausible visible detail that fits that scenario—do not sanitize what they asked for, and do not add unrelated elements.
    - If the scene implies intimacy or nudity, prefer specific anatomical terms over euphemisms (e.g., use "penis" instead of "member," "vagina" instead of "down there").
    - Use explicit positional names when applicable (e.g., "cowgirl position," "missionary position," "doggystyle") rather than vague descriptions.
    - Describe clothing states descriptively: prefer "her panties are pulled down to her thighs" over the fragment "panty pull."
    - Incorporate model-preferred terms naturally where they fit the visual context (e.g., anus, blowjob, boudoir, condoms, deepthroat, braless, cowgirl position, cum, cunnilingus, dildo, doggystyle position, fingering, hand in panties, handjob, hitachi magic wand, implied blowjob, ipcam / nightvision ipcam, masturbation, massage, mission position, naked/nude, penis, pregnant, prone position, reverse cowgirl position, sex, sheer, snapchat, selfie/mirror selfie, spooning position, strap-on dildo, tentacles, licking testicles, undressing, vagina, wet shirt).
    - For borderline cases (e.g., anal sex, anilingus), ensure the description matches the training data style (literal and visual) rather than abstract.

    Style of writing:
    - Favor observational, literal wording over marketing or poetic filler. Use spatial language (left, right, behind, in the distance, filling the frame).
    - Maintain a neutral but descriptive tone that aligns with vision-language dataset labeling standards.
    - Ensure the caption matches the visual density expected by models trained on explicit datasets: if "sex" is mentioned, describe the mechanics and visible anatomy; if "selfie" is mentioned, note the angle and device context—even then, do not invent hair, or facial features not present in the DRAFT.`;

    const message = `Rewrite the following draft into a single CLIP-style detailed caption: dense, literal, and visually specific, as if annotating one photograph for training data. Match the draft's scenario and explicitness. Expand environment, light, camera, setting, and action—but do not add hair, face, skin, age, or body details that the draft does not state (a reference photo provides those).

DRAFT:
${draft}`;

    const upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/getResponse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_prompt: creatorPrompt,
        prompt_prefix: promptPrefix,
        user_name: userName,
        conversation_history: [],
        message,
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error('enhance-image-prompt: Voice AI error', upstream.status, errorText);
      return NextResponse.json(
        { error: 'Failed to enhance prompt' },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 }
      );
    }

    let enhanced = await upstream.text();
    enhanced = enhanced.trim();
    if (enhanced.startsWith('"') && enhanced.endsWith('"')) {
      enhanced = enhanced.slice(1, -1).trim();
    }

    if (!enhanced) {
      return NextResponse.json({ error: 'AI returned an empty prompt' }, { status: 502 });
    }

    return NextResponse.json({ enhanced }, { status: 200 });
  } catch (error) {
    console.error('enhance-image-prompt:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
