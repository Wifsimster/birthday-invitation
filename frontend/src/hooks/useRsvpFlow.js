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
  share_response: false
};

export function useRsvpFlow(slug, onAnswered) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [panel, setPanel] = useState(null);
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
