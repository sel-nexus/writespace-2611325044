/** List the browser's saved posts without mutating their collection. */
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { getPosts } from '../utils/storage.js';
import { getSession } from '../utils/auth.js';

/** Read a fresh, copied newest-first collection and provide a writing entry. */
export default function Home() {
  const posts = [...getPosts()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const session = getSession();

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70dvh] max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h1 className="font-display text-4xl font-bold">Blogs</h1>
          <p className="mt-3 text-slate-600">Writing saved in this browser, newest first.</p>
        </div>
        {posts.length > 0 && (
          <Link to="/write" className="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
            Write a post
          </Link>
        )}
      </header>
      {posts.length === 0 ? (
        <section aria-label="No saved posts" className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-bold">No posts yet</h2>
          <p className="mt-3 text-slate-600">Make room for your first story.</p>
          <Link to="/write" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
            Write a post
          </Link>
        </section>
      ) : (
        <section aria-label="Saved posts" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} session={session} index={index} />
          ))}
        </section>
      )}
    </main>
  );
}
