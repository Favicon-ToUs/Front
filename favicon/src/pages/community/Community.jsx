import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaRegComment, FaRegThumbsUp, FaShareSquare, FaTimes, FaHeart, FaPlus, FaTrash } from "react-icons/fa";
import Modal from "react-modal";
import Cookies from 'js-cookie';
import './Community.css';
import {
  fetchPosts,
  createPost,
  likePost,
  unlikePost,
  fetchCommentsByPostId,
  addComment,
  uploadPostImage,
  updatePost,
  deletePost
} from './CommunityApiService';

Modal.setAppElement('#root');

function Community() {
  const [posts, setPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const observer = useRef();
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentContent, setCommentContent] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImage, setNewPostImage] = useState(null);
  const [showHeart, setShowHeart] = useState(false);
  const [showUnlikeHeart, setShowUnlikeHeart] = useState(false);
  const MAX_CONTENT_LENGTH = 255;
  const currentUserEmail = Cookies.get("userEmail");

  useEffect(() => {
    loadPosts();
  }, []);

  const extractUrl = (markdown) => {
    const regex1 = /!\[.*?\]\((.*?)\)/;
    const regex2 = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|svg))/;
    const match1 = regex1.exec(markdown);
    const match2 = regex2.exec(markdown);
    return match1 ? match1[1] : (match2 ? match2[0] : '');
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetchPosts();
      const postsWithCommentsAndLikes = await Promise.all(response.data.map(async (post) => {
        const commentsResponse = await fetchCommentsByPostId(post.postId);
        return {
          ...post,
          comments: commentsResponse.data,
          commentsCount: commentsResponse.data.length,
          likesCount: post.postLikes ? post.postLikes.length : 0,
          liked: false
        };
      }));
      const sortedPosts = postsWithCommentsAndLikes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPosts(sortedPosts);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const lastPostElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMorePosts();
      }
    });
    if (node) observer.current.observe(node);
  }, []);

  const loadMorePosts = () => {};

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = async (post) => {
    setSelectedPost(post);
    try {
      const response = await fetchCommentsByPostId(post.postId);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedPost(null);
  };

  const handleAddComment = async () => {
    if (!commentContent.trim()) return;
    try {
      await addComment(selectedPost.postId, { content: commentContent });
      const response = await fetchCommentsByPostId(selectedPost.postId);
      setComments(response.data);
      setCommentContent("");

      const updatedPosts = posts.map(post => {
        if (post.postId === selectedPost.postId) {
          return { ...post, comments: response.data, commentsCount: response.data.length };
        }
        return post;
      });
      setPosts(updatedPosts);

      setSelectedPost(prevSelectedPost => ({
        ...prevSelectedPost,
        commentsCount: response.data.length
      }));
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleLike = async (post) => {
    try {
      if (post.liked) {
        await unlikePost(post.postId);
        setShowUnlikeHeart(true);
        setTimeout(() => setShowUnlikeHeart(false), 1000);
        let updatedPost = { ...post, liked: false, likesCount: post.likesCount - 1 };
        setPosts(posts.map(p => p.postId === post.postId ? updatedPost : p));
        if (selectedPost && selectedPost.postId === post.postId) {
          setSelectedPost(updatedPost);
        }
      } else {
        await likePost(post.postId);
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 1000);
        let updatedPost = { ...post, liked: true, likesCount: post.likesCount + 1 };
        setPosts(posts.map(p => p.postId === post.postId ? updatedPost : p));
        if (selectedPost && selectedPost.postId === post.postId) {
          setSelectedPost(updatedPost);
        }
      }
    } catch (error) {
      console.error('Failed to update like status:', error);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await deletePost(postId);
      setPosts(posts.filter(post => post.postId !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const openCreatePostModal = () => {
    setIsCreatePostModalOpen(true);
  };

  const closeCreatePostModal = () => {
    setIsCreatePostModalOpen(false);
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      return;
    }
  
    if (newPostContent.length > MAX_CONTENT_LENGTH) {
      alert(`게시글 내용은 ${MAX_CONTENT_LENGTH}자 이내로 작성해주세요.`);
      return;
    }
    try {
      const response = await createPost({ title: newPostTitle, content: newPostContent });
      const postId = response.data.postId;
  
      if (newPostImage) {
        const formData = new FormData();
        formData.append('image', newPostImage);
  
        const uploadResponse = await uploadPostImage(postId, formData);
        const imageUrl = extractUrl(uploadResponse.data);
  
        await updatePost(postId, {
          title: newPostTitle,
          content: newPostContent,
          thumbnailImageId: imageUrl
        });
      } else {
        await updatePost(postId, {
          title: newPostTitle,
          content: newPostContent
        });
      }
  
      await loadPosts();
      closeCreatePostModal();
      setNewPostTitle("");
      setNewPostContent("");
      setNewPostImage(null);
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };
  
  const handleContentChange = (e) => {
    const content = e.target.value;
    if (content.length <= MAX_CONTENT_LENGTH) {
      setNewPostContent(content);
    }
  };
  

  const handleImageChange = (e) => {
    setNewPostImage(e.target.files[0]);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="community-content">
      <div className="search-and-create">
        <input
          type="text"
          placeholder="Search posts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-community-posts"
        />
        <button onClick={openCreatePostModal} className="create-post-button">
          <FaPlus />
        </button>
      </div>

      <div className="posts-list">
        {filteredPosts.map((post, index) => (
          <div
            key={post.postId}
            ref={index === filteredPosts.length - 1 ? lastPostElementRef : null}
            className="post-item"
          >
            <div className="card">
              <div className="post-header">
                <h3>{post.title}</h3>
                {post.userId === currentUserEmail && (
                  <button className="delete-button" onClick={() => handleDeletePost(post.postId)}>
                    <FaTrash />
                  </button>
                )}
              </div>
              <div onClick={() => openModal(post)} className={`post-body ${post.thumbnailImageId ? 'with-image' : 'without-image'}`}>
                <p>{post.content}</p>
                {post.thumbnailImageId && <img src={post.thumbnailImageId} alt="Post Thumbnail" className="post-thumbnail" />}
              </div>
              <div className="post-actions">
                <button className="like-button" onClick={() => handleLike(post)}>
                  {post.liked ? <FaHeart className={`heart-icon${showHeart ? ' animate-heart' : ''}`} /> : <FaRegThumbsUp />}
                  <span>{post.likesCount}</span>
                </button>
                <button className="comment-button" onClick={() => openModal(post)}>
                  <FaRegComment />
                  <span>{post.commentsCount}</span>
                </button>
                <button className="share-button">
                  <FaShareSquare />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalIsOpen} onRequestClose={closeModal} className="post-modal">
        <div className="modal-content">
          <button onClick={closeModal} className="close-modal-button">
            <FaTimes />
          </button>
          {selectedPost && (
            <>
              <h2>{selectedPost.title}</h2>
              <p>{selectedPost.content}</p>
              <div className="post-actions">
                <button className="like-button" onClick={() => handleLike(selectedPost)}>
                  {selectedPost.liked ? <FaHeart className={`heart-icon${showHeart ? ' animate-heart' : ''}`} /> : <FaRegThumbsUp />}
                  <span>{selectedPost.likesCount}</span>
                </button>
              </div>
              <div className="comments-section">
                {comments.map((comment, index) => (
                  <div key={index} className="comment">
                    <p>{comment.content}</p>
                  </div>
                ))}
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add a comment..."
                />
                <button onClick={handleAddComment} className="add-comment-button">
                  Add Comment
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal isOpen={isCreatePostModalOpen} onRequestClose={closeCreatePostModal} className="create-post-modal">
        <h2>Create New Post</h2>
        <input
          type="text"
          value={newPostTitle}
          onChange={(e) => setNewPostTitle(e.target.value)}
          placeholder="Post Title"
          className="post-title-input"
        />
        <textarea
          value={newPostContent}
          onChange={handleContentChange}
          placeholder="Write your post..."
          className="post-content-input"
        />
        <input type="file" onChange={handleImageChange} className="image-upload-input" />
        <button onClick={handleCreatePost} className="create-post-button">
          Create Post
        </button>
        <button onClick={closeCreatePostModal} className="close-modal-button">
          Cancel
        </button>
      </Modal>
    </div>
  );
}

export default Community;
