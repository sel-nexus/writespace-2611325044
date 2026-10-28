/** Resolve a saved post and render its body as safe, whitespace-preserved text. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { getPosts } from '../utils/storage.js';
import { getSession } from '../utils/auth.js';
import { canManagePost, deletePost } from '../utils/posts.js';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/** Show safe text and owner/admin controls; persist only a confirmed deletion. */
export default function ReadBlog() {
  const { id } = useParams();
  const post = getPosts().find((record) => record.id === id);
  const session = getSession();
  const canEdit = canManagePost(post, session);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Confirm intent, then repeat permission and target reads at deletion time. */
  function remove() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const result = deletePost(id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate('/blogs');
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-12 sm:px-6">
      <Link
        to="/blogs"
        className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 font-medium text-indigo-600
          hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}
      >
        Back to blogs
      </Link>
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {error}
        </p>
      )}
      {!post ? (
        <h1 className="mt-8 font-display text-4xl font-bold">Post not found</h1>
      ) : (
        <article className="mx-auto mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
          <h1 className="break-words font-display text-4xl font-bold">{post.title}</h1>
          <div className="mt-6 flex items-center gap-3">
            <Avatar role={post.authorId === 'admin' ? 'admin' : 'user'} />
            <div className="min-w-0 text-sm text-slate-500">
              <p className="break-words">By {post.authorName}</p>
              <time dateTime={post.createdAt}>
                {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })}
              </time>
            </div>
          </div>
          <p className="mt-8 whitespace-pre-wrap break-words text-lg leading-relaxed text-slate-800">{post.content}</p>
          {canEdit && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={`/edit/${encodeURIComponent(post.id)}`}
                className={`inline-flex min-h-11 items-center rounded-lg border border-indigo-200 bg-white px-4 py-2
                  font-medium text-indigo-600 hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}
              >
                Edit post
              </Link>
              <button
                type="button"
                onClick={remove}
                className={`min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600
                  hover:bg-red-100 motion-safe:transition-colors ${focus}`}
              >
                Delete post
              </button>
            </div>
          )}
        </article>
      )}
    </main>
  );
}
