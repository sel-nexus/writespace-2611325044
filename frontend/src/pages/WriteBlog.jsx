/** Offer a plaintext create/edit form with no persistence until explicit Save. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { getPosts } from '../utils/storage.js';
import { canManagePost, createPost, editPost } from '../utils/posts.js';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const button = `min-h-11 rounded-lg px-4 py-2 font-medium motion-safe:transition-colors ${focus}`;

/** Bind required editable text to its label, counter, and validation feedback.
 * Args:
 *   name: Editable field key.
 *   label: Visible accessible label.
 *   value: Current draft text.
 *   error: Required-field feedback, if any.
 *   onChange: Draft-only input callback.
 */
function PostField({ name, label, value, error, onChange }) {
  const multiline = name === 'content';
  const Control = multiline ? 'textarea' : 'input';
  const describedBy = [multiline ? 'post-counter' : '', error ? `post-${name}-error` : ''].filter(Boolean).join(' ');
  return (
    <div>
      <label htmlFor={`post-${name}`} className="block font-medium">
        {label}
      </label>
      <Control
        id={`post-${name}`}
        name={name}
        value={value}
        onChange={onChange}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={`mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 ${multiline ? 'min-h-64' : 'min-h-11'} ${focus}`}
      />
      {multiline && (
        <p id="post-counter" className="mt-2 text-sm tabular-nums text-slate-500">
          {value.length} characters
        </p>
      )}
      {error && (
        <p id={`post-${name}-error`} role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

PostField.propTypes = {
  name: PropTypes.oneOf(['title', 'content']).isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  error: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

/** Retain a draft and actionable errors when validation or fresh permission fails.
 * Args:
 *   id: Selected saved identifier in edit mode, otherwise absent.
 *   post: Initial persisted record used only to populate draft fields.
 */
function PostEditor({ id, post }) {
  const [values, setValues] = useState({ title: post?.title || '', content: post?.content || '' });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  /** Change draft text without writing storage. */
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** Save against fresh identity/records; only successful persistence may navigate. */
  function submit(event) {
    event.preventDefault();
    const result = id ? editPost(id, values) : createPost(values);
    if (!result.ok) {
      setErrors({ ...result.errors, form: result.errors ? undefined : result.message });
      return;
    }
    navigate(`/blog/${encodeURIComponent(result.post.id)}`);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
      <h1 className="font-display text-4xl font-bold">
        {id ? 'Edit post' : 'Write a post'}
      </h1>
      <p className="mt-3 text-slate-600">
        Your thoughts, in your own words. Posts are saved only in this browser.
      </p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-6">
        <PostField name="title" label="Title" value={values.title} error={errors.title} onChange={change} />
        <PostField name="content" label="Content" value={values.content} error={errors.content} onChange={change} />
        {errors.form && (
          <p role="alert" className="text-sm text-red-700">
            {errors.form}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={`${button} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700`}>
            Save post
          </button>
          <Link to="/blogs" className={`${button} inline-flex items-center text-slate-500 hover:bg-slate-100`}>
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

PostEditor.propTypes = {
  id: PropTypes.string,
  post: PropTypes.shape({ title: PropTypes.string.isRequired, content: PropTypes.string.isRequired }),
};

/** Resolve route-load access and remount drafts when the selected identifier changes. */
export default function WriteBlog() {
  const { id } = useParams();
  const session = getSession();
  const post = id ? getPosts().find((record) => record.id === id) : undefined;
  if (!session) return <Navigate to="/login" replace />;
  if (id && post && !canManagePost(post, session)) return <Navigate to="/blogs" replace />;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto min-h-[70dvh] max-w-3xl px-4 py-12 sm:px-6">
      {id && !post ? (
        <>
          <h1 className="font-display text-4xl font-bold">Post not found</h1>
          <Link to="/blogs" className={`${button} mt-6 inline-flex items-center text-indigo-600 hover:bg-indigo-50`}>
            Back to blogs
          </Link>
        </>
      ) : (
        <PostEditor key={id || 'create'} id={id} post={post} />
      )}
    </main>
  );
}
