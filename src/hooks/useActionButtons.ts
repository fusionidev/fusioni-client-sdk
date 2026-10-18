import {useEffect, useRef, useState} from 'react';
import type {ActionButtonsProps} from '../types/actionButtons';
import {ActionButtonsController, initialActionButtonsState} from '../utils/actionButtonsController';

export function useActionButtons(props: ActionButtonsProps) {
  const latest = useRef(props);
  latest.current = props;
  const [state, setState] = useState(initialActionButtonsState);
  const controllerRef = useRef<ActionButtonsController | null>(null);
  if (!controllerRef.current) controllerRef.current = new ActionButtonsController(() => latest.current, setState);
  const controller = controllerRef.current;
  useEffect(() => {
    void controller.loadActions();
    return () => controller.dispose();
  }, [controller, props.apiClient]);
  useEffect(() => {
    if (state.fieldFormVisible && controller.isDisabled(state.selectedAction)) controller.cancelFields();
  }, [controller, props.actionEnabledStates, state.fieldFormVisible, state.selectedAction]);
  return {state, controller};
}
