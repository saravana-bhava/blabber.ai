import React, { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { submitPollVote } from '@/app/actions/postActions'; // Assuming path is correct
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface PollOption {
  id: string;
  text: string;
  order: number;
  // votes_count will be added dynamically from pollResults state
}

interface PollVoteResult {
  option_id: string;
  vote_count: number;
}

interface PollDisplayProps {
  postId: string;
  options: PollOption[];
  initialResults?: PollVoteResult[]; // Optional: if results are pre-fetched with post
  initialUserVote?: string | null;   // Optional: if user's vote is pre-fetched
}

export function PollDisplay({ postId, options, initialResults, initialUserVote }: PollDisplayProps) {
  const [pollResults, setPollResults] = useState<PollVoteResult[]>(initialResults || []);
  const [userVotedOption, setUserVotedOption] = useState<string | null>(initialUserVote || null);
  const [isSubmitting, startTransition] = useTransition();
  // Ensures that once a vote is cast OR initialUserVote is present, the UI behaves as "voted"
  const [hasVotedOrLoadedVote, setHasVotedOrLoadedVote] = useState(!!initialUserVote);

  // Sync state if initial props change (e.g. parent re-fetches)
  useEffect(() => {
    setPollResults(initialResults || []);
  }, [initialResults]);

  useEffect(() => {
    setUserVotedOption(initialUserVote || null);
    setHasVotedOrLoadedVote(!!initialUserVote); // Update this flag as well
  }, [initialUserVote]);
  
  // This effect ensures that if initialUserVote is provided, and we don't have pollResults,
  // we make one call to fetch the results. The `isFetchingOnly = true` ensures no new vote is cast.
  useEffect(() => {
    if (initialUserVote && (!initialResults || initialResults.length === 0) && pollResults.length === 0) {
      handleVote(initialUserVote, true); 
    }
    // Adding pollResults.length to dependency array to avoid re-triggering if results arrive from this call.
  }, [initialUserVote, initialResults, postId, pollResults.length]); // Dependencies ensure it runs if these key props change

  if (!options || options.length === 0) {
    return <p className="text-sm text-muted-foreground">Poll data is not available.</p>;
  }

  const handleVote = async (optionId: string, isFetchingOnly: boolean = false) => {
    // Prevent re-voting if already voted in this session or vote loaded initially, unless just fetching.
    if (!isFetchingOnly && hasVotedOrLoadedVote) {
        toast.info("You have already voted in this poll.");
        return;
    }

    startTransition(async () => {
      try {
        // If isFetchingOnly is true, optionId might be empty or a dummy value.
        // The server action submitPollVote is designed to return current results even if the vote itself is a duplicate or empty.
        const response = await submitPollVote(postId, optionId);
        if (response.success) {
          setPollResults(response.results || []);
          setUserVotedOption(response.userVote || null);
          if (response.userVote) { // If a vote is registered (new or existing)
            setHasVotedOrLoadedVote(true); // Mark as voted
            if (!isFetchingOnly) {
              toast.success('Vote submitted!');
            }
          } else if (!isFetchingOnly && optionId) {
            console.warn("Vote submitted but not reflected in userVote response", response);
            toast.info("Already voted or vote not registered."); 
          }
        } else {
          toast.error(response.error || 'Failed to submit vote.');
        }
      } catch (e: any) {
        toast.error(e.message || 'An unexpected error occurred.');
      }
    });
  };

  const totalVotes = pollResults.reduce((sum, result) => sum + result.vote_count, 0);

  return (
    <div className="mt-3 space-y-2">
      {options.sort((a, b) => a.order - b.order).map((option) => {
        const result = pollResults.find(r => r.option_id === option.id);
        const votes = result ? result.vote_count : 0;
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        
        const isUserChoice = userVotedOption === option.id;
        const showResults = hasVotedOrLoadedVote;

        let buttonBaseClasses = "w-full justify-start text-left h-auto py-2 px-3 relative overflow-hidden transition-colors duration-150 ease-in-out";
        let buttonBgClasses = ""; // For button background only
        let barBgClass = "";
        let optionTextClass = "font-medium"; // Default font weight for option text
        let percentageTextClass = "font-semibold text-sm";

        if (showResults) {
          if (isUserChoice) {
            buttonBgClasses = "bg-pink-600 hover:bg-pink-700 ring-2 ring-pink-500 dark:ring-pink-400 ring-offset-1 dark:ring-offset-background cursor-not-allowed";
            barBgClass = "bg-pink-400 dark:bg-pink-700"; 
            optionTextClass += " text-white dark:text-pink-50"; 
            percentageTextClass += " text-white dark:text-pink-100";
          } else {
            buttonBgClasses = "bg-background hover:bg-accent border cursor-not-allowed";
            optionTextClass += " text-foreground hover:text-accent-foreground";
            barBgClass = "bg-pink-500/30 dark:bg-pink-600/30";
            percentageTextClass += " text-pink-600 dark:text-pink-400";
          }
        } else {
          buttonBgClasses = "bg-background hover:bg-accent border";
          optionTextClass += " text-foreground hover:text-accent-foreground";
        }

        return (
          <Button
            key={option.id}
            // Construct className carefully, ensure no conflicting text colors on Button itself
            className={`${buttonBaseClasses} ${buttonBgClasses}`}
            onClick={() => !hasVotedOrLoadedVote && handleVote(option.id)}
            disabled={isSubmitting || hasVotedOrLoadedVote}
          >
            {showResults && (
              <div 
                className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${barBgClass}`}
                style={{ width: `${percentage}%` }}
              />
            )}
            <div className="relative z-10 flex justify-between w-full items-center">
              <span className={optionTextClass}>{option.text}</span>
              {isSubmitting && !hasVotedOrLoadedVote && (
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              )}
              {showResults && (
                <span className={percentageTextClass}>
                  {percentage}%
                </span>
              )}
            </div>
          </Button>
        );
      })}
      {totalVotes > 0 && hasVotedOrLoadedVote && (
        <p className="text-xs text-muted-foreground mt-2 text-right">Total votes: {totalVotes}</p>
      )}
    </div>
  );
} 