'use client';

import NextImage, { type ImageProps } from 'next/image';
import { shouldBypassNextImageOptimization } from '@/lib/utils/remote-image';
import { cn } from '@/lib/utils';

type RemoteImageProps = Omit<ImageProps, 'src' | 'unoptimized'> & {
  src: string;
};

/**
 * Uses a native <img> for placeholder / Supabase URLs so the browser fetches directly
 * (never `/_next/image`, which fails for picsum in local dev).
 */
export function RemoteImage({
  src,
  alt = '',
  className,
  fill,
  width,
  height,
  sizes,
  style,
  onLoad,
  onError,
  priority,
  ...rest
}: RemoteImageProps) {
  if (shouldBypassNextImageOptimization(src)) {
    if (fill) {
      return (
        <img
          src={src}
          alt={alt}
          className={cn('h-full w-full', className)}
          sizes={sizes}
          style={{ position: 'absolute', inset: 0, ...style }}
          fetchPriority={priority ? 'high' : undefined}
          onLoad={onLoad as React.ReactEventHandler<HTMLImageElement>}
          onError={onError as React.ReactEventHandler<HTMLImageElement>}
        />
      );
    }

    return (
      <img
        src={src}
        alt={alt}
        width={typeof width === 'number' ? width : undefined}
        height={typeof height === 'number' ? height : undefined}
        className={className}
        style={style}
        fetchPriority={priority ? 'high' : undefined}
        onLoad={onLoad as React.ReactEventHandler<HTMLImageElement>}
        onError={onError as React.ReactEventHandler<HTMLImageElement>}
      />
    );
  }

  return (
    <NextImage
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      style={style}
      onLoad={onLoad}
      onError={onError}
      priority={priority}
      {...rest}
    />
  );
}
