import React from 'react';
import {Spotlight} from './Spotlight';
import {BotIcon} from './ActionIcon';

export interface MessageStreamLoadingProps {
    streamMessages: string[];
    loadingLabel: string;
    botIcon?: string | null;
    botIconColor?: string | null;
}

/** Logo + Spotlight: SSE stream lines, or loading label until first stream event */
export const MessageStreamLoading: React.FC<MessageStreamLoadingProps> = ({
    streamMessages,
    loadingLabel,
    botIcon,
    botIconColor,
}) => {
    const lines = streamMessages.length > 0 ? streamMessages : [loadingLabel];

    return (
        <div className="fusioni-stream-messages">
            {lines.map((line, index) => (
                <div
                    key={streamMessages.length > 0 ? `${index}-${line}` : 'loading-placeholder'}
                    className="fusioni-stream-message-item"
                >
                    <div className="fusioni-stream-message-logo-wrap">
                        <div className="fusioni-stream-message-logo-frame">
                            <BotIcon
                                className="fusioni-stream-message-logo-img"
                                icon={botIcon}
                                color={botIconColor}
                                size={32}
                            />
                        </div>
                    </div>
                    <Spotlight className="fusioni-stream-message-spotlight" text={line} />
                </div>
            ))}
        </div>
    );
};
