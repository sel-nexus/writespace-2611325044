/** Present a saved post preview without reading or writing persistence. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';

const borders = ['border-indigo-600', 'border-violet-600', 'border-pink-500', 'border-teal-500'];
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/** Show a bounded excerpt and navigation permitted by the supplied principal.
 * Args:
 *   post: Complete saved post to preview.
 *   session: Current principal, or null for a guest preview.
 *   onEdit: Optional notification when the permitted edit link is selected.
 *   index: Sorted position used to repeat the four border accents.
 * Returns:
 *   A semantic article with reading and eligible editing links.
 */
export function BlogCard({ post, session = null, onEdit, index = 0 }) {
  const canEdit = Boolean(session && (session.role === 'admin' || session.userId === post.authorId));
  const authorRole = post.authorId === 'admin' ? 'admin' : 'user';
  const date = new Date(post.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <article className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 border-t-4 bg-white p-6 ${borders[index % borders.length]}`}>
      <h2 className="break-words font-display text-2xl font-bold">{post.title}</h2>
      <p className="mt-3 break-words leading-relaxed text-slate-600">
        {post.content.slice(0, 120)}{post.content.length > 120 ? '…' : ''}
      </p>
      <div className="mt-5 flex items-center gap-3">
        <Avatar role={authorRole} />
        <div className="min-w-0 text-sm text-slate-500">
          <p className="break-words">By {post.authorName}</p>
          <time dateTime={post.createdAt}>{date}</time>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-3 pt-6">
        <Link to={`/blog/${encodeURIComponent(post.id)}`} aria-label={`Read ${post.title}`} className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}>
          Read
        </Link>
        {canEdit && (
          <Link to={`/edit/${encodeURIComponent(post.id)}`} onClick={() => onEdit?.(post)} aria-label={`Edit ${post.title}`} className={`inline-flex min-h-11 items-center rounded-lg border border-indigo-200 bg-white px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}>
            Edit
          </Link>
        )}
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
  }).isRequired,
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
  onEdit: PropTypes.func,
  index: PropTypes.number,
};
