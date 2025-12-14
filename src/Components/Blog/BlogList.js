import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { blogPosts } from '../../data/blogPosts';
import './Blog.css';

const BlogList = () => {
  const { t } = useTranslation();

  // Sort posts by date (newest first)
  const sortedPosts = [...blogPosts].sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  );

  return (
    <div className="blog-page">
      {/* SEO Header */}
      <header className="blog-header">
        <Link to="/" className="blog-back-link">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {t('blog.backToApp', 'Back to NurseQuizAI')}
        </Link>
        <h1 className="blog-main-title">
          {t('blog.title', 'Nursing Study Tips & NCLEX Prep Guide')}
        </h1>
        <p className="blog-subtitle">
          {t('blog.subtitle', 'Expert advice, study strategies, and resources to help you pass NCLEX on your first attempt')}
        </p>
      </header>

      {/* Blog Grid */}
      {/* Note: Blog content is English only, so we use English titles/excerpts */}
      <main className="blog-grid">
        {sortedPosts.map((post) => (
          <article key={post.slug} className="blog-card">
            <Link to={`/blog/${post.slug}`} className="blog-card-link">
              {post.image && (
                <div className="blog-card-image">
                  <img src={post.image} alt={post.title} loading="lazy" />
                </div>
              )}
              <div className="blog-card-content">
                <div className="blog-card-meta">
                  <span className="blog-card-category">{post.category}</span>
                  <span className="blog-card-date">
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <h2 className="blog-card-title">{post.title}</h2>
                <p className="blog-card-excerpt">{post.excerpt}</p>
                <div className="blog-card-footer">
                  <span className="blog-card-read-time">
                    {post.readTime} {t('blog.minRead', 'min read')}
                  </span>
                  <span className="blog-card-cta">
                    {t('blog.readMore', 'Read more')} →
                  </span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </main>

      {/* CTA Section */}
      <section className="blog-cta-section">
        <h2>{t('blog.ctaTitle', 'Ready to ace your NCLEX?')}</h2>
        <p>{t('blog.ctaText', 'Turn your nursing notes into practice quizzes in seconds with AI.')}</p>
        <Link to="/signup" className="blog-cta-button">
          {t('blog.ctaButton', 'Start Free Today')}
        </Link>
      </section>

      {/* Footer */}
      <footer className="blog-footer">
        <p>© 2025 NurseQuizAI - {t('blog.footerText', 'AI-Powered NCLEX Preparation')}</p>
      </footer>
    </div>
  );
};

export default BlogList;
