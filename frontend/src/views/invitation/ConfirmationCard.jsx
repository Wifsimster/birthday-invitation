import { Button } from '@/components/ui/button';

/**
 * The answer, read back to the guest who just gave it.
 *
 * Deliberately outside the theme palette: "je viens" and "je ne viens pas" have
 * to read as an answer at a glance, in any theme. The stops are dark enough to
 * carry white text at WCAG AA — the pastel pair they replaced sat at 2:1.
 */
export default function ConfirmationCard({ confirmed, onEdit }) {
  return (
    <div
      className={`rounded-2xl p-6 text-center text-white ${
        confirmed.isAttending
          ? 'bg-linear-to-br from-[#0E7D5D] to-[#0A6047]'
          : 'bg-linear-to-br from-[#C2415A] to-[#9E2740]'
      }`}
      role="status"
    >
      {confirmed.isAttending ? (
        <>
          <h2 className="text-xl font-bold">🎉 Merci {confirmed.name} !</h2>
          <p className="mt-2">Ta réponse est bien enregistrée. À très bientôt ! 🎈</p>
          <div className="mt-4 space-y-1 opacity-90">
            <p>👨‍👩‍👧‍👦 {confirmed.guests} personne(s)</p>
            {confirmed.message && <p>💌 {confirmed.message}</p>}
          </div>
        </>
      ) : (
        <>
          <h2 className="text-xl font-bold">Merci {confirmed.name}</h2>
          <p className="mt-2">Dommage que tu ne puisses pas venir. 😔</p>
          {confirmed.message && <p className="mt-4 opacity-90">💌 {confirmed.message}</p>}
        </>
      )}
      <Button
        variant="outline"
        className="mt-5 rounded-full border-white/30 bg-white/20 text-white hover:bg-white/30 hover:text-white"
        onClick={onEdit}
      >
        Modifier ma réponse
      </Button>
    </div>
  );
}
