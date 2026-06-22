-- Create function to increment comment count on posts
create or replace function increment_comment_count(p_post_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  update posts 
  set comment_count = comment_count + 1
  where id = p_post_id
  returning comment_count into new_count;
  
  return coalesce(new_count, 0);
end;
$$;

-- Create function to decrement comment count on posts
create or replace function decrement_comment_count(p_post_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  update posts 
  set comment_count = greatest(comment_count - 1, 0)
  where id = p_post_id
  returning comment_count into new_count;
  
  return coalesce(new_count, 0);
end;
$$;

-- Create function to increment comment like count
create or replace function increment_comment_like_count(p_comment_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  update comments 
  set like_count = like_count + 1
  where id = p_comment_id
  returning like_count into new_count;
  
  return coalesce(new_count, 0);
end;
$$;

-- Create function to decrement comment like count
create or replace function decrement_comment_like_count(p_comment_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  update comments 
  set like_count = greatest(like_count - 1, 0)
  where id = p_comment_id
  returning like_count into new_count;
  
  return coalesce(new_count, 0);
end;
$$;

-- Create function to increment reply count on comments
create or replace function increment_reply_count(p_parent_comment_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  update comments 
  set reply_count = reply_count + 1
  where id = p_parent_comment_id
  returning reply_count into new_count;
  
  return coalesce(new_count, 0);
end;
$$;

-- Create function to decrement reply count on comments
create or replace function decrement_reply_count(p_parent_comment_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_count integer;
begin
  update comments 
  set reply_count = greatest(reply_count - 1, 0)
  where id = p_parent_comment_id
  returning reply_count into new_count;
  
  return coalesce(new_count, 0);
end;
$$; 