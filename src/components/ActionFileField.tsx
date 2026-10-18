import React, {useEffect, useRef, useState} from 'react';
import {FileUpload} from './FileUpload';
import {readFileDataUrl} from '../utils/readFileDataUrl';

interface PickedFile {id: number; file: File; url?: string; controller: AbortController}

export const ActionFileField: React.FC<{
  inputId: string; label: string; disabled?: boolean;
  onChange: (files: string[]) => void; onPendingChange: (pending: boolean) => void;
}> = ({inputId, label, disabled, onChange, onPendingChange}) => {
  const [items, setItems] = useState<PickedFile[]>([]);
  const [error, setError] = useState('');
  const itemsRef = useRef(items);
  const nextId = useRef(0);
  const mounted = useRef(false);
  const callbacks = useRef({onChange, onPendingChange});
  callbacks.current = {onChange, onPendingChange};
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; itemsRef.current.forEach(item => item.controller.abort()); };
  }, []);
  const publish = (next: PickedFile[]): void => {
    itemsRef.current = next;
    setItems(next);
    callbacks.current.onChange(next.flatMap(item => item.url ? [item.url] : []));
    callbacks.current.onPendingChange(next.some(item => !item.url));
  };
  const remove = (id: number): void => {
    itemsRef.current.find(item => item.id === id)?.controller.abort();
    publish(itemsRef.current.filter(item => item.id !== id));
  };
  const pick = (files: File[]): void => {
    const added = files.slice(0, 8 - itemsRef.current.length).map(file => ({id: ++nextId.current, file, controller: new AbortController()}));
    publish([...itemsRef.current, ...added]);
    setError('');
    for (const item of added) {
      void readFileDataUrl(item.file, item.controller.signal).then(url => {
        if (mounted.current && !item.controller.signal.aborted) publish(itemsRef.current.map(current => current.id === item.id ? {...current, url} : current));
      }, failure => {
        if (mounted.current && !item.controller.signal.aborted) { remove(item.id); setError(failure.message); }
      });
    }
  };
  return <div className="fusioni-action-files">
    <div className="fusioni-action-file-list">{items.map(item => <div key={item.id} className="fusioni-action-file">
      {item.url?.startsWith('data:image/') && <img src={item.url} alt={item.file.name} />}
      <span>{item.file.name}</span>
      {!item.url && <span className="fusioni-spinner" aria-label="Reading file" />}
      <button type="button" disabled={disabled} onClick={() => remove(item.id)} aria-label={`Remove ${item.file.name}`}>×</button>
    </div>)}</div>
    <div className="fusioni-action-file-picker">
      <FileUpload inputId={inputId} label={label} multiple accept="*/*" maxSize={Infinity} disabled={disabled || items.length >= 8} onFilesSelect={pick} onError={failure => setError(failure.message)} />
      <span>{items.length} / 8</span>
    </div>
    {error && <p role="alert" className="fusioni-action-field-error">{error}</p>}
  </div>;
};
