/** Show bounded browser-local post activity and explicit admin content controls. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { getSession } from '../utils/auth.js';
import { getPosts } from '../utils/storage.js';
import { deletePost } from '../utils/posts.js';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/** Copy and sort saved records without mutating the source collection.
 * Args:
 *   posts: Complete validated local collection.
 * Returns:
 *   A new newest-first collection.
 */
function newestFirst(posts) {
  return [...posts].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

/** Render the authorized working view; update it only after persisted deletion. */
function DashboardContent() {
  const [posts, setPosts] = useState(() => newestFirst(getPosts()));
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const recent = posts.slice(0, 5);

  /** Fail closed when an earlier admin view outlives the current session. */
  function requireAdmin() {
    if (getSession()?.role === 'admin') return true;
    setError('Admin access is required. Sign in as an admin before changing posts.');
    return false;
  }

  /** Confirm intent and repeat the admin predicate immediately before mutation.
   * Args:
   *   id: Identifier selected from the visible recent list.
   * Notes:
   *   The shared helper re-reads the target and complete collection itself.
   */
  function remove(id) {
    if (!requireAdmin()) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    if (!requireAdmin()) return;
    const result = deletePost(id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPosts(newestFirst(result.posts));
    setError('');
    setStatus('Post deleted.');
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-12 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-violet-700">Content oversight</p>
          <h1 className="mt-3 font-display text-4xl font-bold">Admin dashboard</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Review the five newest posts saved in this browser. Admins can manage any local post.
          </p>
        </div>
        <nav aria-label="Dashboard actions" className="flex flex-wrap gap-3">
          <Link
            to="/write"
            className={`inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2 font-medium
              text-white shadow-sm hover:bg-indigo-700 motion-safe:transition-colors ${focus}`}
          >
            Write
          </Link>
          <Link
            to="/users"
            className={`inline-flex min-h-11 items-center rounded-lg border border-indigo-200 bg-white px-4 py-2
              font-medium text-indigo-600 hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}
          >
            Manage users
          </Link>
        </nav>
      </header>
      <section aria-label="Local activity" className="mt-8 max-w-2xl">
        <StatCard
          label="Recent local activity"
          value={recent[0]?.title ?? 'No posts yet'}
          color="border-violet-200 bg-violet-50"
        />
        <p className="mt-3 text-sm text-slate-500">
          Latest saved post title, not an account total or analytics metric. Data stays in this browser.
        </p>
      </section>
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {error}
        </p>
      )}
      <p role="status" className="mt-4 text-sm text-slate-600">
        {status}
      </p>
      <section aria-labelledby="recent-posts-heading" className="mt-8">
        <h2 id="recent-posts-heading" className="font-display text-2xl font-bold">Recent posts</h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-slate-600">No posts yet. Select Write to create a local post.</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {recent.map((post) => (
              <li key={post.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <article aria-label={post.title} className="flex flex-wrap items-center justify-between gap-5">
                  <div className="min-w-0 flex-1 basis-64">
                    <h3 className="break-words font-display text-xl font-bold">{post.title}</h3>
                    <p className="mt-2 break-words text-sm text-slate-500">By {post.authorName}</p>
                    <time dateTime={post.createdAt} className="mt-1 block text-sm text-slate-500">
                      {new Date(post.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
                      })}
                    </time>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/blog/${encodeURIComponent(post.id)}`}
                      aria-label={`Read ${post.title}`}
                      className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 font-medium text-indigo-600
                        hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}
                    >
                      Read
                    </Link>
                    <Link
                      to={`/edit/${encodeURIComponent(post.id)}`}
                      aria-label={`Edit ${post.title}`}
                      className={`inline-flex min-h-11 items-center rounded-lg border border-indigo-200 bg-white px-4 py-2
                        font-medium text-indigo-600 hover:bg-indigo-50 motion-safe:transition-colors ${focus}`}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(post.id)}
                      aria-label={`Delete ${post.title}`}
                      className={`min-h-11 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600
                        hover:bg-red-100 motion-safe:transition-colors ${focus}`}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/** Guard direct component use as well as the route composition. */
export default function AdminDashboard() {
  return (
    <ProtectedRoute adminOnly>
      <DashboardContent />
    </ProtectedRoute>
  );
}
