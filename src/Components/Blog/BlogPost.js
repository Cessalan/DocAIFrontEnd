import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { blogPosts } from '../../data/blogPosts';
import { blogContent } from '../../data/blogContent';
import './Blog.css';

const BlogPost = () => {
  const { slug } = useParams();
  const { t } = useTranslation();

  // Find the post metadata
  const post = blogPosts.find(p => p.slug === slug);

  // Get content directly from JS (no fetch needed - avoids SPA routing issues)
  const content = blogContent[slug] || '';

  // Update document title for SEO
  // Note: Always use English title since blog content is in English only
  useEffect(() => {
    if (post) {
      document.title = `${post.title} | NurseQuizAI Blog`;

      // Update meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', post.excerpt);
      }
    }

    return () => {
      document.title = 'NurseQuizAI - AI Nursing Quiz Generator';
    };
  }, [post]);

  // Scroll to top when navigating to a new post
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return (
      <div className="blog-page">
        <div className="blog-not-found">
          <h1>404</h1>
          <p>{t('blog.notFound', 'Blog post not found')}</p>
          <Link to="/blog" className="blog-cta-button">
            {t('blog.backToBlog', 'Back to Blog')}
          </Link>
        </div>
      </div>
    );
  }

  // Always use English title since content is English only
  const title = post.title;

  return (
    <div className="blog-page">
      <header className="blog-header blog-post-header">
        <Link to="/blog" className="blog-back-link">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {t('blog.backToBlog', 'Back to Blog')}
        </Link>
      </header>

      <article className="blog-article">
        {/* Article Header */}
        <header className="blog-article-header">
          <div className="blog-article-meta">
            <span className="blog-card-category">{post.category}</span>
            <span className="blog-card-date">
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            <span className="blog-card-read-time">
              {post.readTime} {t('blog.minRead', 'min read')}
            </span>
          </div>
          <h1 className="blog-article-title">{title}</h1>
          {post.author && (
            <p className="blog-article-author">
              {t('blog.by', 'By')} {post.author}
            </p>
          )}
        </header>

        {/* Article Content */}
        <div className="blog-article-content">
          <ReactMarkdown
            components={{
              h1: ({children}) => <h1 className="blog-h1">{children}</h1>,
              h2: ({children}) => <h2 className="blog-h2">{children}</h2>,
              h3: ({children}) => <h3 className="blog-h3">{children}</h3>,
              p: ({children}) => <p className="blog-p">{children}</p>,
              ul: ({children}) => <ul className="blog-ul">{children}</ul>,
              ol: ({children}) => <ol className="blog-ol">{children}</ol>,
              li: ({children}) => <li className="blog-li">{children}</li>,
              blockquote: ({children}) => <blockquote className="blog-quote">{children}</blockquote>,
              code: ({inline, children}) =>
                inline ? <code className="blog-inline-code">{children}</code> : <pre className="blog-code-block"><code>{children}</code></pre>,
              a: ({href, children}) => {
                // Internal links use React Router
                if (href?.startsWith('/')) {
                  return <Link to={href} className="blog-link">{children}</Link>;
                }
                return <a href={href} className="blog-link" target="_blank" rel="noopener noreferrer">{children}</a>;
              },
              img: ({src, alt}) => <img src={src} alt={alt} className="blog-content-image" loading="lazy" />,
              strong: ({children}) => <strong className="blog-strong">{children}</strong>,
              table: ({children}) => <div className="blog-table-wrapper"><table className="blog-table">{children}</table></div>,
              thead: ({children}) => <thead>{children}</thead>,
              tbody: ({children}) => <tbody>{children}</tbody>,
              tr: ({children}) => <tr>{children}</tr>,
              th: ({children}) => <th>{children}</th>,
              td: ({children}) => <td>{children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="blog-tags">
            {post.tags.map(tag => (
              <span key={tag} className="blog-tag">{tag}</span>
            ))}
          </div>
        )}
      </article>

      {/* CTA Section */}
      <section className="blog-cta-section">
        <h2>{t('blog.ctaTitle', 'Ready to ace your NCLEX?')}</h2>
        <p>{t('blog.ctaText', 'Turn your nursing notes into practice quizzes in seconds with AI.')}</p>
        <Link to="/signup" className="blog-cta-button">
          {t('blog.ctaButton', 'Start Free Today')}
        </Link>
      </section>

      {/* Related Posts */}
      {post.relatedSlugs && post.relatedSlugs.length > 0 && (
        <section className="blog-related">
          <h2 className="blog-related-title">{t('blog.relatedPosts', 'Related Articles')}</h2>
          <div className="blog-related-grid">
            {post.relatedSlugs.map(relatedSlug => {
              const relatedPost = blogPosts.find(p => p.slug === relatedSlug);
              if (!relatedPost) return null;

              return (
                <Link key={relatedSlug} to={`/blog/${relatedSlug}`} className="blog-related-card">
                  <span className="blog-card-category">{relatedPost.category}</span>
                  <h3>{relatedPost.title}</h3>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="blog-footer">
        <p>© 2025 NurseQuizAI - {t('blog.footerText', 'AI-Powered NCLEX Preparation')}</p>
      </footer>
    </div>
  );
};

export default BlogPost;
