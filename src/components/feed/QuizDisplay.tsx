import React, { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { recordQuizAttempt } from '@/app/actions/postActions'; // Assuming path is correct
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean; // This comes from the post.metadata
  order: number;
}

interface UserAttempt {
  selectedOptionId: string;
  isCorrect: boolean;
}

interface QuizDisplayProps {
  postId: string;
  options: QuizOption[];
  initialAttempt?: UserAttempt | null; // Optional: if user's attempt is pre-fetched
}

export function QuizDisplay({ postId, options, initialAttempt }: QuizDisplayProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(initialAttempt?.selectedOptionId || null);
  const [userAttempt, setUserAttempt] = useState<UserAttempt | null>(initialAttempt || null);
  const [isSubmitting, startTransition] = useTransition();

  // If an initial attempt is provided, the quiz should start in the revealed state.
  const [revealed, setRevealed] = useState(!!initialAttempt);

  useEffect(() => {
    if (initialAttempt) {
      setSelectedOptionId(initialAttempt.selectedOptionId);
      setUserAttempt(initialAttempt);
      setRevealed(true);
    }
  }, [initialAttempt]);

  if (!options || options.length === 0) {
    return <p className="text-sm text-muted-foreground">Quiz data is not available.</p>;
  }

  const handleSelectOption = (optionId: string) => {
    if (revealed || isSubmitting) return;
    setSelectedOptionId(optionId);
  };

  const handleSubmitAnswer = () => {
    if (!selectedOptionId) {
      toast.error('Please select an answer.');
      return;
    }

    const chosenOption = options.find(opt => opt.id === selectedOptionId);
    if (!chosenOption) {
      toast.error('Selected option not found. Please try again.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await recordQuizAttempt(postId, selectedOptionId, chosenOption.isCorrect);
        if (response.success) {
          if (response.attempt) {
            setUserAttempt(response.attempt);
            toast.success(response.attempt.isCorrect ? 'Correct! Great job!' : 'That was not the correct answer.');
          } else if (response.previousAttempt) {
            // This case means the user already attempted, and the server returned their prior attempt.
            setUserAttempt(response.previousAttempt);
            toast.info('You have already attempted this quiz. Showing your previous answer.');
          } else {
             // Should not happen if success is true based on server action logic
             toast.info('Attempt recorded.'); 
          }
          setRevealed(true);
        } else {
          toast.error(response.error || 'Failed to submit your answer.');
           if (response.previousAttempt) { // If error also includes previous attempt data
            setUserAttempt(response.previousAttempt);
            setRevealed(true);
          }
        }
      } catch (e: any) {
        toast.error(e.message || 'An unexpected error occurred.');
      }
    });
  };

  // Determine the actual selected ID for display based on userAttempt or current selection
  const displaySelectedOptionId = userAttempt ? userAttempt.selectedOptionId : selectedOptionId;

  return (
    <div className="mt-3 space-y-2">
      {options.sort((a, b) => a.order - b.order).map((option) => {
        const isSelectedForDisplay = displaySelectedOptionId === option.id;
        let buttonVariant: "outline" | "default" | "secondary" = "outline";
        let resultText = "";
        let icon = null;

        if (revealed && userAttempt) {
          if (option.isCorrect) {
            buttonVariant = "default";
            resultText = option.id === userAttempt.selectedOptionId ? " (Your Correct Answer)" : " (Correct Answer)";
          } else if (isSelectedForDisplay && !option.isCorrect) {
            buttonVariant = "secondary";
            resultText = " (Your Incorrect Answer)";
          }
        } else if (isSelectedForDisplay && !revealed) {
          buttonVariant = "secondary"; // Highlight current selection before submitting
        }

        return (
          <Button
            key={option.id}
            variant={buttonVariant}
            className={`w-full justify-start text-left h-auto py-2.5 px-3 transition-all duration-150 ease-in-out
              ${revealed && option.isCorrect ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20' : ''}
              ${revealed && isSelectedForDisplay && !option.isCorrect ? 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20' : ''}
              ${!revealed && isSelectedForDisplay ? 'border-pink-500 ring-1 ring-pink-500' : ''}
              ${revealed || isSubmitting ? 'cursor-not-allowed' : ''}
            `}
            onClick={() => handleSelectOption(option.id)}
            disabled={revealed || isSubmitting}
          >
            {option.text}
            {revealed && resultText && <span className="ml-1.5 font-normal text-xs">{resultText}</span>}
          </Button>
        );
      })}
      {!revealed && (
        <Button 
          onClick={handleSubmitAnswer} 
          className="mt-4 w-full bg-pink-500 hover:bg-pink-600 text-white" 
          disabled={isSubmitting || !selectedOptionId}
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
          {isSubmitting ? 'Submitting...' : 'Submit Answer'}
        </Button>
      )}
      {revealed && userAttempt && (
         <p className={`text-sm font-medium mt-3 p-2.5 border rounded-md ${userAttempt.isCorrect ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'}`}>
            {userAttempt.isCorrect 
                ? "You got it right! 🎉"
                : "That wasn't the correct answer. Better luck next time!"
            }
        </p>
      )}
    </div>
  );
} 