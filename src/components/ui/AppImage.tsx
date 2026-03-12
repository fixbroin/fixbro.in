"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface AppImageProps {
  src?: string | null
  alt: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  className?: string
  "data-ai-hint"?: string
}

export default function AppImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  priority = false,
  className,
  "data-ai-hint": aiHint
}: AppImageProps) {

  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const isDefaultImage = !src || error
  const imageSrc = isDefaultImage ? "/default-image.png" : src

  return (
    <div className={cn("relative overflow-hidden", fill ? "w-full h-full" : "inline-block", className)}>

      {!loaded && (
        <Image
          src="/default-image.png"
          alt="loading placeholder"
          fill={fill}
          width={!fill ? width : undefined}
          height={!fill ? height : undefined}
          className="object-contain animate-pulse bg-muted"
        />
      )}

      <Image
        src={imageSrc}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        data-ai-hint={aiHint}
        className={cn(
          "transition-opacity duration-300",
          isDefaultImage ? "object-contain bg-muted" : "object-cover",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />

    </div>
  )
}