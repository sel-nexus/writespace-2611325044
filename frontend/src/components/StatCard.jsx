/** Display a caller-defined local activity value without deriving metrics. */
import PropTypes from 'prop-types';

/** Present a label and value without persistence or independent calculations.
 * Args:
 *   label: Description of the supplied value.
 *   value: Defined descriptive text or number supplied by the caller.
 *   icon: Optional decorative element, hidden from assistive technology.
 *   color: Tailwind color utilities for the accent surface.
 * Returns:
 *   A semantic description of the caller's value.
 */
export function StatCard({ label, value, icon, color = 'border-violet-200 bg-violet-50' }) {
  return (
    <dl className={`rounded-2xl border p-6 ${color}`}>
      <dt className="flex items-center gap-3 text-sm font-medium text-slate-600">
        {icon != null && (
          <span aria-hidden="true" className="shrink-0">
            {icon}
          </span>
        )}
        {label}
      </dt>
      <dd className="mt-3 break-words font-display text-2xl font-bold text-slate-800">
        {value}
      </dd>
    </dl>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.node,
  color: PropTypes.string,
};
