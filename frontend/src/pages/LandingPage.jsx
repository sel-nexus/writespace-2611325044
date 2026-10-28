/** Introduce the local writing demo and preview its three newest saved posts. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { getPosts } from '../utils/storage.js';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const features = [
  { name: 'Write Freely', text: 'A simple space for stories, notes, and ideas. Put your words first.', style: 'bg-indigo-50 border-indigo-100 md:row-span-2' },
  { name: 'Private & Local', text: 'Posts stay in this browser. No shared server, syncing, or cloud account.', style: 'bg-white border-slate-200' },
  { name: 'Instant & Fast', text: 'Read local posts and move between pages without waiting for a data API.', style: 'bg-teal-50 border-teal-100' },
];
const borders = ['border-indigo-600', 'border-violet-600', 'border-pink-500', 'border-teal-500'];

/** Render a public introduction without creating or repairing persisted records.
 * Args:
 *   session: Current validated principal, used only for reading navigation.
 * Returns:
 *   Hero, three feature cards, local previews or exact empty state, and demo notice.
 */
export default function LandingPage({ session = null }) {
  const [posts] = useState(() => [...getPosts()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3));

  return (
    <>
      <main id="main-content" tabIndex={-1}>
        <section
          aria-labelledby="hero-title"
          className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-20"
        >
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-indigo-700">A place for your words</p>
            <h1 id="hero-title" className="font-display text-hero font-bold text-slate-800">
              Your thoughts. Your space. Beautifully simple.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
              A browser-local writing demo for collecting ideas, finding stories, and making room for your own.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className={`whitespace-nowrap rounded-full bg-indigo-600 px-6 py-3 font-medium text-white shadow-sm hover:bg-indigo-700 motion-safe:transition-colors motion-safe:duration-gentle ${focus}`}
              >
                Get Started Free
              </Link>
              <Link
                to={session ? '/blogs' : '/login'}
                className={`whitespace-nowrap rounded-full border border-indigo-200 bg-white px-6 py-3 font-medium text-indigo-700 hover:bg-indigo-50 ${focus}`}
              >
                Start Reading
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto flex min-h-72 w-full max-w-sm items-center justify-center p-6 md:min-h-96">
            <div className="absolute h-56 w-56 rounded-full bg-gradient-to-br from-indigo-200 via-violet-200 to-pink-200" />
            <div className="relative w-full rotate-[-3deg] rounded-2xl border border-indigo-100 bg-white p-8 shadow-focal motion-safe:animate-float">
              <span className="text-sm font-medium text-slate-500">A little room to think</span>
              <p className="mt-5 font-display text-3xl leading-snug text-slate-800">Every story starts with a thought.</p>
              <p className="mt-5 leading-relaxed text-slate-600">Keep the idea. Find the words. Make it yours.</p>
              <div className="mt-6 h-1 w-12 rounded-full bg-indigo-600" />
            </div>
          </div>
        </section>

        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="features-title" className="mb-8 font-display text-3xl font-bold">Less clutter. More writing.</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {features.map((feature) => (
              <article key={feature.name} className={`flex flex-col justify-center rounded-2xl border p-8 ${feature.style}`}>
                <h3 className="font-display text-2xl font-bold">{feature.name}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-slate-600">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="latest-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="latest-title" className="font-display text-3xl font-bold">Latest from the Blog</h2>
          <p className="mt-3 text-slate-600">Recent writing saved in this browser.</p>
          {posts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="text-lg font-medium">No posts yet — check back soon!</p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <article
                  key={post.id}
                  className={`min-w-0 rounded-2xl border border-slate-200 border-t-4 bg-white p-6 ${borders[index % borders.length]}`}
                >
                  <time dateTime={post.createdAt} className="text-sm text-slate-500">
                    {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })}
                  </time>
                  <h3 className="mt-3 break-words font-display text-2xl font-bold">
                    <Link
                      to={`/blog/${encodeURIComponent(post.id)}`}
                      className={`rounded-sm hover:text-indigo-700 ${focus}`}
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-3 break-words leading-relaxed text-slate-600">
                    {post.content.slice(0, 120)}
                    {post.content.length > 120 ? '…' : ''}
                  </p>
                  <p className="mt-5 break-words text-sm text-slate-500">
                    {'By '}
                    {post.authorName}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="bg-slate-900 px-4 py-10 text-slate-200 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-display text-2xl font-bold text-white">WriteSpace</p>
          <p className="mt-3">Your writing lives in this browser. Clearing local storage removes local data.</p>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed">
            Demo only: passwords are stored in plain text and access checks run in your browser. Do not use real passwords or sensitive data.
          </p>
        </div>
      </footer>
    </>
  );
}

LandingPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
