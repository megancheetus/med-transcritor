'use client';

import { useEffect, useState } from 'react';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  category?: string;
  thumbnail?: string;
}

export default function BlogWidget() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      try {
        const response = await fetch('/api/posts.json');
        if (!response.ok) throw new Error('fetch failed');
        const data = await response.json();
        const items = Array.isArray(data) ? data : data?.posts ?? [];
        if (!cancelled) {
          setPosts(items.slice(0, 3));
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPosts();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[#4b6573]">
        Carregando artigos...
      </div>
    );
  }

  if (error || posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-red-500">
        {error ? 'Não foi possível carregar os artigos.' : 'Nenhum artigo disponível.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
          <a
            key={post.id}
            href={`https://www.edvaldojeronimo.com.br/blog/${post.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-[#cfe0e8] bg-[#f7fbfc] overflow-hidden hover:border-[#1a6a8d] hover:shadow-md transition"
          >
            {post.thumbnail && (
              <img
                src={post.thumbnail}
                alt={post.title}
                className="w-full h-36 object-cover"
                loading="lazy"
              />
            )}
            <div className="p-4">
              {post.category && (
                <span className="inline-block rounded-full bg-[#e8f5fb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1a6a8d] mb-2">
                  {post.category}
                </span>
              )}
              <h4 className="text-sm font-bold text-[#0c161c] line-clamp-2 leading-snug">
                {post.title}
              </h4>
              {post.excerpt && (
                <p className="mt-1.5 text-xs text-[#4b6573] line-clamp-3 leading-relaxed">
                  {post.excerpt}
                </p>
              )}
              {post.date && (
                <p className="mt-2 text-[10px] text-[#7b8d97]">
                  {new Date(post.date).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </a>
        ))}
    </div>
  );
}
