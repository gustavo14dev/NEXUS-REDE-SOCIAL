// Código para adicionar ao final do feed.js

// Cole este código no final do arquivo feed.js (depois da linha 1590)

// Carregar informações de quem curtiu um post específico
async function loadLikesInfo(postId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('likes')
            .select(`
                profiles: user_id (
                    id,
                    nome,
                    avatar_url
                )
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        
        const likesInfo = document.getElementById(`likes-info-${postId}`);
        if (likesInfo && data.length > 0) {
            const latestLike = data[0].profiles;
            const post = posts.find(p => p.id === postId);
            const otherCount = Math.max(0, (post?.likes_count || 0) - 1);
            
            likesInfo.innerHTML = `
                <div class="likes-info-content">
                    <img src="${latestLike.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Crect width=\'24\' height=\'24\' fill=\'%2339FF14\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' fill=\'white\' font-family=\'Arial\' font-size=\'12\'%3E?%3C/text%3E%3C/svg%3E'}" alt="Avatar" class="likes-avatar">
                    <span class="likes-text">
                        <strong>${latestLike.nome}</strong> e mais ${otherCount} ${otherCount === 1 ? 'pessoa' : 'pessoas'} curtiram isso
                    </span>
                </div>
            `;
            likesInfo.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro ao carregar informações de likes:', error);
    }
}
