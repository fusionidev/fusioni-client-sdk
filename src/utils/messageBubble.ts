import {FusioniMemoryMessage} from '../types';

export const FUSIONI_SDK_OPTIMISTIC_USER = 'fusion_sdk_optimistic_user' as const;

export interface MessageOwner {
  name?: string;
  first_name?: string;
  last_name?: string;
  owner_id?: string;
  type?: string;
  color?: string;
}

export const getMessageOwner = (message: FusioniMemoryMessage): MessageOwner | null => {
  const owner = message.extra_data?.owner;
  return owner && typeof owner === 'object' ? owner as MessageOwner : null;
};

export const isAgentMessage = (message: FusioniMemoryMessage): boolean =>
  getMessageOwner(message)?.type === 'AGENT';

/**
 * Match fusion-web's ownership rule: a user-role message is rendered on the
 * local-user side when there is no current owner, when it is the optimistic
 * local SDK message, or when its persisted owner id matches the current owner.
 */
export const isMessageOwner = (
  message: FusioniMemoryMessage,
  currentOwnerId?: string | null,
): boolean => {
  if (message.role !== 'user') {
    return false;
  }

  if (message.extra_data?.[FUSIONI_SDK_OPTIMISTIC_USER] === true) {
    return true;
  }

  const ownerId = currentOwnerId?.trim();
  if (!ownerId) {
    return true;
  }

  return getMessageOwner(message)?.owner_id === ownerId;
};

/** Resolve the Fusion owner (`oid`) from the JWT used by the web client. */
export const getOwnerIdFromAccessToken = (accessToken?: string): string | undefined => {
  if (!accessToken || typeof globalThis.atob !== 'function') {
    return undefined;
  }

  const token = accessToken.replace(/^(?:Bearer|ApiKey)\s+/i, '').trim();
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) {
    return undefined;
  }

  try {
    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(globalThis.atob(padded)) as {oid?: unknown};
    return typeof payload.oid === 'string' && payload.oid.trim()
      ? payload.oid.trim()
      : undefined;
  } catch {
    return undefined;
  }
};

export const getAgentName = (message: FusioniMemoryMessage): string => {
  const name = getMessageOwner(message)?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Agent';
};

export const getAgentInitials = (message: FusioniMemoryMessage): string => {
  const name = getAgentName(message);
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);

  return initials.toUpperCase();
};

const normalizeHexColor = (color?: string): string | null => {
  const value = color?.trim();
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
};

const hexToRgba = (color: string, alpha: number): string => {
  const hex = color.replace('#', '');
  const red = parseInt(hex.substring(0, 2), 16);
  const green = parseInt(hex.substring(2, 4), 16);
  const blue = parseInt(hex.substring(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

export const getAgentAccentClass = (message: FusioniMemoryMessage): string => {
  if (normalizeHexColor(getMessageOwner(message)?.color)) {
    return 'fusioni-agent-custom-color';
  }

  const owner = getMessageOwner(message);
  const key = `${owner?.owner_id || ''}${owner?.name || ''}` || 'agent';
  let hash = 0;
  for (let index = 0; index < key.length; index++) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return `fusioni-agent-accent-${hash % 7}`;
};

export const getAgentBubbleStyle = (message: FusioniMemoryMessage): Record<string, string> => {
  const color = normalizeHexColor(getMessageOwner(message)?.color);
  if (!color) {
    return {};
  }

  return {
    '--fusioni-agent-color': color,
    '--fusioni-agent-bg': hexToRgba(color, 0.12),
    '--fusioni-agent-bg-dark': hexToRgba(color, 0.24),
    '--fusioni-agent-border': hexToRgba(color, 0.36),
    '--fusioni-agent-border-dark': hexToRgba(color, 0.56),
  };
};

/** Highlight agent mentions without modifying links or code blocks. */
export const highlightAgentMentions = (content: string): string => {
  if (!content || !content.includes('@')) {
    return content;
  }

  const protectedBlocks: string[] = [];
  const contentWithPlaceholders = content.replace(
    /<(pre|code|a)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (block) => {
      const placeholder = `\uE000${protectedBlocks.length}\uE001`;
      protectedBlocks.push(block);
      return placeholder;
    },
  );

  const highlightedContent = contentWithPlaceholders
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith('<')) {
        return part;
      }

      return part.replace(
        /(^|[^\p{L}\p{N}_@])@([\p{L}\p{N}_][\p{L}\p{N}_.-]*)/gu,
        '$1<span class="fusioni-agent-mention">@$2</span>',
      );
    })
    .join('');

  return highlightedContent.replace(
    /\uE000(\d+)\uE001/g,
    (_placeholder, index: string) => protectedBlocks[Number(index)] || '',
  );
};
