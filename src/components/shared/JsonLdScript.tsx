
"use client";

import Script from 'next/script';
import { useId } from 'react';

interface JsonLdScriptProps {
  data: Record<string, unknown>;
  idSuffix?: string; // To make ID more unique if multiple on page
}

const JsonLdScript: React.FC<JsonLdScriptProps> = ({ data, idSuffix }) => {
  const reactId = useId();
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  // Generate a base ID, make it more unique if suffix is provided
  const baseId = `json-ld-${(data['@type'] as string)?.toLowerCase().replace(/[^a-z0-9]/gi, '') || 'data'}`;
  const scriptId = idSuffix ? `${baseId}-${idSuffix}` : `${baseId}-${reactId.replace(/:/g, '')}`;


  return (
    <Script
      id={scriptId}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
};

export default JsonLdScript;

    