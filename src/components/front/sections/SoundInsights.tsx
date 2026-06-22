import React from "react";
import BlogCard from "../ui/BlogCards";
import TagButton from "../ui/TagButton";

export default function SoundInsights() {
  return (
    <section className="max-w-[1200px] pt-32 px-4 overflow-hidden mx-auto">
      {/* Header Row: responsive */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        {/* Left: Tag + Title */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <TagButton
              label="Blogs"
              withIcon
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M21.44 11.05 12.95 19.56a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.88 17.17" />
                </svg>
              }
            />
          </div>
          <h2 className="text-3xl font-bold text-foreground-900">Sound Insights</h2>
        </div>

        {/* Right: Description */}
        <p className="text-foreground-600 max-w-md md:text-right">
          Stay updated with the latest trends in audio technology, speaker
          innovations, and expert tips to enhance your listening experience.
        </p>
      </div>

      {/* Blog Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="mx-auto w-full max-w-sm">
          <BlogCard
            title="The Evolution of Speakers"
            date="Feb 1, 2025"
            imageSrc="/Blog-1.png"
          />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <BlogCard
            title="Right Speaker for You"
            date="Feb 1, 2025"
            imageSrc="/Blog-2.png"
          />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <BlogCard
            title="Wireless Speakers"
            date="Feb 1, 2025"
            imageSrc="/Blog-3.png"
          />
        </div>
      </div>
    </section>
  );
}
