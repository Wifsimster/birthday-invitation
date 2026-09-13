import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { eventUrl, slugForFile } from './format.js';

/** The invitation's link, its QR code and the ways to send both. */
export default function SharePanel({ event, onCopyLink, linkCopied }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const invitationUrl = eventUrl(event);

  // The QR code belongs to this panel alone, so it is drawn when the panel is on
  // screen rather than kept in the console's state for every tab.
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(invitationUrl, { width: 512, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [invitationUrl]);

  const whatsAppShareUrl = useMemo(() => {
    const person = event?.person || '';
    const text = person
      ? `Tu es invité(e) à l'anniversaire de ${person} ! 🎉 ${invitationUrl}`
      : `Tu es invité(e) ! 🎉 ${invitationUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [event, invitationUrl]);

  const qrFileName = `qr-${slugForFile(event?.person) || 'invitation'}.png`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden="true">🔗</span> Partager l'invitation
        </CardTitle>
        <CardDescription>Diffuse ce lien ou ce QR code pour inviter tes convives.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={invitationUrl}
            readOnly
            aria-label="Lien de l'invitation"
            onFocus={(e) => e.target.select()}
          />
          <Button className="shrink-0" onClick={() => onCopyLink(invitationUrl)}>
            {linkCopied ? <CheckIcon /> : <CopyIcon />}
            {linkCopied ? 'Copié' : 'Copier le lien'}
          </Button>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button asChild variant="outline" size="sm">
            <a href={whatsAppShareUrl} target="_blank" rel="noopener">
              <SendIcon />
              Envoyer sur WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={invitationUrl} target="_blank" rel="noopener">
              <ExternalLinkIcon />
              Ouvrir l'invitation
            </a>
          </Button>
          {qrDataUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={qrDataUrl} download={qrFileName}>
                <DownloadIcon />
                Télécharger le QR
              </a>
            </Button>
          )}
        </div>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="QR code de l'invitation"
            className="mx-auto size-48 rounded-xl border bg-white p-2 sm:mx-0"
          />
        )}
      </CardContent>
    </Card>
  );
}
