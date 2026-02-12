// Função createPostHTML corrigida com ícones Material Icons válidos

function createPostHTML(post) {
    const profile = post.profiles;
    const isOwner = profile?.id === currentUser?.id;
    
    const mediaHTML = post.media_url ? (post.media_type === 'video' 
        ? `<div class="post-media"><video controls><source src="${post.media_url}" type="video/mp4"></video></div>`
        : `<div class="post-media"><img src="${post.media_url}" alt="Post" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22 viewBox=%220 0 400 300%22%3E%3Crect width=%22400%22 height=%22300%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%239ca3af%22 font-family=%22Arial%22 font-size=%2216%22%3EImagem não encontrada%3C/text%3E%3C/svg%3E'"></div>`) : '';

    return `
        <div class="post-card glass">
            <div class="post-header">
                <img src="${profile?.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2245%22 height=%2245%22 viewBox=%220 0 45 45%22%3E%3Crect width=%2245%22 height=%2245%22 fill=%22%2339FF14%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2220%22%3E?%3C/text%3E%3C/svg%3E'}" alt="${profile?.nome || 'Usuário'}" class="post-avatar">
                <div class="post-info">
                    <h4>${profile?.nome || 'Usuário'}</h4>
                    <span>${profile?.turma || 'Sem círculo'} • ${formatDate(post.created_at)}</span>
                </div>
                ${isOwner ? `<button class="delete-post-btn" onclick="deletePost('${post.id}')" title="Excluir post">
                    <svg class="delete-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>` : ''}
            </div>
            ${post.caption ? `<div class="post-caption">${post.caption}</div>` : ''}
            ${mediaHTML}
            <div class="post-actions">
                <button class="action-btn like-btn" onclick="toggleLike('${post.id}')">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3s4.08 2.42 4.5 5.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span>${post.likes_count || 0}</span>
                </button>
                <button class="action-btn comment-btn">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <span>${post.comments_count || 0}</span>
                </button>
                <button class="action-btn share-btn">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7 0-.24-.04-.47-.09-.7-.15l7.05-4.11c.54.5 1.25.81 2.01.81 3.33 0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5c1.38 0 2.64.56 3.54 1.46l-1.41-1.41c-.64.64-1.52 1.04-2.49 1.04-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5c0 .39-.08.74-.21 1.08l1.41 1.41c.13-.34.21-.69.21-1.08z"/>
                    </svg>
                    <span>${post.shares_count || 0}</span>
                </button>
            </div>
        </div>
    `;
}
