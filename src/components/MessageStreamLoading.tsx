import React from 'react';
import {Spotlight} from './Spotlight';
import {FUSIONI_LOGO_BASE64} from '../assets/logo-base64';

export interface MessageStreamLoadingProps {
    streamMessages: string[];
    loadingLabel: string;
}

/** Logo + Spotlight: SSE stream lines, or loading label until first stream event */
export const MessageStreamLoading: React.FC<MessageStreamLoadingProps> = ({
    streamMessages,
    loadingLabel,
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
                            <img
                                className="fusioni-stream-message-logo-img"
                                src={FUSIONI_LOGO_BASE64}
                                alt=""
                                width={32}
                                height={32}
                            />
                        </div>
                    </div>
                    <Spotlight className="fusioni-stream-message-spotlight" text={line} />
                </div>
            ))}
        </div>
    );
};
