'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { searchUserProfiles } from '@/app/actions/postActions';

interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface UserSearchResultsProps {
  searchQuery: string | null;
}

export function UserSearchResults({ searchQuery }: UserSearchResultsProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchProfiles = async () => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setProfiles([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await searchUserProfiles(searchQuery, 5);
        
        if (result.error) {
          setError(result.error);
          setProfiles([]);
        } else {
          setProfiles(result.data || []);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to search profiles');
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the search
    const timer = setTimeout(searchProfiles, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleProfileClick = (username: string) => {
    router.push(`/u/${username}`);
  };

  if (!searchQuery || searchQuery.trim().length < 2) {
    return null;
  }

  if (loading) {
    return (
      <div className="px-4 py-3 border-b border-border/60">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 border-b border-border/60">
        <div className="text-sm text-red-500">Error searching profiles: {error}</div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return null;
  }

  return (
    <div className="px-0 py-0">
      <div className="space-y-0">
        {profiles.map((profile) => (
          <Card 
            key={profile.id} 
            className="cursor-pointer hover:bg-muted/50 rounded-none transition-colors py-3 border-none"
            onClick={() => handleProfileClick(profile.username!)}
          >
            <CardContent className="p-3 py-0">
              <div className="flex items-center space-x-3">
                <Avatar className="w-12 h-12 rounded-full">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>
                    {(profile.full_name || profile.username || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {profile.username}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {profile.full_name || profile.username}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 