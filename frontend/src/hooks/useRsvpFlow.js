// The guest's answer, from the first tap to the confirmation panel.
//
// Opening the form, retrieving an earlier answer, submitting, and the
// "modifier ma réponse" way back are one flow with one piece of state between
// them — kept together here rather than as nine `useState`s in the view.

import { useCallback, useState } from 'react';
import { rsvpsApi } from '../api/index.js';

export const EMPTY_FORM = {
  attending: 'yes',
  name: '',
  phone: '',
  email: '',
  guests: 1,
  dietary_restrictions: '',
  message: '',
  // Opt-in, never pre-ticked: sharing has to be a deliberate gesture.
  share_response: false
};

/**
 * `onAnswered(phone, attending)` fires once the guest has proved who they are —
 * by answering or by retrieving their answer — which is what unlocks the guest
 * list.
 */
export function useRsvpFlow(slug, onAnswered) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [panel, setPanel] = useState(null); // null | 'rsvp' | 'lookup'
  const [lookupPhone, setLookupPhone] = useState('');
  const [confirmed, setConfirmed] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const open = useCallback((which) => {
    setErrorMessage('');
    setPanel(which);
  }, []);

  const cancel = useCallback(() => {
    setPanel(null);
    setErrorMessage('');
  }, []);

  /** Back to the start, keeping the guest's answer available to edit. */
  const reset = useCallback(() => {
    setConfirmed(null);
    setPanel(null);
    setErrorMessage('');
    setLookupPhone('');
    setForm(EMPTY_FORM);
  }, []);

  const submit = useCallback(
    async (e) => {
      e.preventDefault();
      setSubmitting(true);
      setErrorMessage('');
      try {
        await rsvpsApi.submit(slug, {
          attending: form.attending,
          name: form.name,
          email: form.email,
          phone: form.phone,
          guests: form.guests,
          dietary_restrictions: form.dietary_restrictions,
          message: form.message,
          share_response: form.share_response
        });
        const isAttending = form.attending === 'yes';
        setConfirmed({
          isAttending,
          name: form.name,
          guests: form.guests,
          message: form.message,
          shareResponse: isAttending && form.share_response
        });
        setPanel(null);
        onAnswered(form.phone, isAttending);
      } catch (err) {
        setErrorMessage(err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [slug, form, onAnswered]
  );

  const lookup = useCallback(
    async (e) => {
      e.preventDefault();
      setLookingUp(true);
      setErrorMessage('');
      try {
        if (!lookupPhone || lookupPhone.trim().length === 0) {
          throw new Error('Le numéro de téléphone est requis');
        }
        const data = await rsvpsApi.lookup(slug, lookupPhone.trim());
        setForm({
          attending: data.attending || 'yes',
          name: data.name,
          email: data.email || '',
          phone: data.phone,
          guests: data.guests || 1,
          dietary_restrictions: data.dietary_restrictions || '',
          message: data.message || '',
          share_response: Boolean(data.share_response)
        });
        setPanel('rsvp');
        setLookupPhone('');
        // Retrieving one's own response proves the same thing a submission
        // does, so a guest coming back gets the list without answering again.
        onAnswered(data.phone, data.attending === 'yes');
      } catch (err) {
        setErrorMessage(err.message);
      } finally {
        setLookingUp(false);
      }
    },
    [slug, lookupPhone, onAnswered]
  );

  return {
    form,
    setForm,
    panel,
    open,
    cancel,
    reset,
    confirmed,
    errorMessage,
    submitting,
    lookingUp,
    lookupPhone,
    setLookupPhone,
    submit,
    lookup
  };
}
