import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const isDev = import.meta.env.DEV

function getApiUrl(path) {
  if (!apiBaseUrl && !isDev) {
    throw new Error('Backend URL is not configured. Add VITE_API_BASE_URL in GitHub Pages secrets, then rerun the deploy workflow.')
  }

  return `${apiBaseUrl}${path}`
}

function PosterMarquee({ dramas = [], onOpenDrama }) {
  if (dramas.length === 0) return null

  const posters = [...dramas, ...dramas]

  return (
    <div className="poster-marquee" aria-label="Popular Korean drama posters">
      <div className="poster-track">
        {posters.map((drama, index) => (
          <button
            type="button"
            className="poster-tile"
            key={`${drama.title}-${index}`}
            onClick={() => onOpenDrama?.(drama)}
            aria-label={`Read synopsis for ${drama.title}`}
          >
            <img src={drama.image} alt={`${drama.title} poster`} draggable="false" />
          </button>
        ))}
      </div>
    </div>
  )
}

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [isLogin, setIsLogin] = useState(true)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email for the login link!')
      }
    } catch (error) {
      setError(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
      <form onSubmit={handleAuth} className="auth-form">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
        </button>
        {error && <p className="error">{error}</p>}
        {message && <p className="success" style={{ color: '#4ade80' }}>{message}</p>}
      </form>
      <button className="text-button" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
      </button>
    </div>
  )
}

function MainApp({ session, popularDramas, loadingPopular, popularError, selectedDetailDrama, setSelectedDetailDrama }) {
  const [query, setQuery] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [activeTab, setActiveTab] = useState('search') // 'search' or 'collections'
  const [collections, setCollections] = useState([])
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [successModal, setSuccessModal] = useState(null)
  const [activeCollectionName, setActiveCollectionName] = useState(null)
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDrama, setSelectedDrama] = useState(null)
  const [selectedCollections, setSelectedCollections] = useState([])
  const [newCollectionName, setNewCollectionName] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }

  const openDramaDetail = (drama) => {
    setSelectedDetailDrama(drama)
    setCollectionMenuOpen(false)
  }

  const closeDramaDetail = () => {
    setSelectedDetailDrama(null)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const recommendationsUrl = getApiUrl(`/api/recommendations?q=${encodeURIComponent(query)}`)
      const response = await fetch(recommendationsUrl, {
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        }
      })
      if (!response.ok) {
        let message = `Backend returned ${response.status}.`
        try {
          const errorBody = await response.json()
          message = errorBody.detail || message
        } catch {
          // Some proxy/server errors are plain text instead of JSON.
        }
        throw new Error(message)
      }
      const data = await response.json()
      setRecommendations(data)
      setSelectedDetailDrama(null)
    } catch (err) {
      console.error(err)
      const message = err.message === 'Failed to fetch'
        ? 'Could not reach the backend. If you are testing locally, start FastAPI on port 8000. If this is GitHub Pages, set VITE_API_BASE_URL to your Render backend URL and redeploy.'
        : err.message
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCollections = async () => {
    setLoadingCollections(true)
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCollections(data || [])
    } catch (error) {
      console.error('Error fetching collections:', error)
    } finally {
      setLoadingCollections(false)
    }
  }

  const groupedCollections = collections.reduce((acc, curr) => {
    const name = curr.collection_name || 'My Collections'
    if (!acc[name]) acc[name] = []
    acc[name].push(curr)
    return acc
  }, {})

  const collectionFolders = Object.entries(groupedCollections)
  const activeCollectionDramas = activeCollectionName ? groupedCollections[activeCollectionName] || [] : []

  const openSaveModal = (drama) => {
    fetchCollections()
    setSelectedDrama(drama)
    setSelectedCollections([])
    setNewCollectionName('')
    setIsModalOpen(true)
  }

  const openCollections = () => {
    setActiveTab('collections')
    setActiveCollectionName(null)
    setCollectionMenuOpen(false)
    setSelectedDetailDrama(null)
    fetchCollections()
  }

  const openCollectionFolder = (collectionName) => {
    setActiveCollectionName(collectionName)
    setCollectionMenuOpen(false)
  }

  const closeCollectionFolder = () => {
    setActiveCollectionName(null)
    setCollectionMenuOpen(false)
  }

  const handleSaveCollection = async () => {
    if (!selectedDrama) return

    const targets = new Set([...selectedCollections])
    if (newCollectionName.trim()) {
      targets.add(newCollectionName.trim())
    }

    if (targets.size === 0) {
      targets.add('My Collections')
    }

    const insertData = Array.from(targets).map(cName => ({
      user_id: session.user.id,
      drama_title: selectedDrama.title,
      synopsis: selectedDrama.synopsis,
      image_url: selectedDrama.image,
      collection_name: cName
    }))

    try {
      const { error } = await supabase
        .from('favorites')
        .insert(insertData)

      if (error) {
        if (error.code === '23505') showToast(`This drama is already in this collection`)
        else throw error
      } else {
        const savedCollectionNames = Array.from(targets)
        const collectionLabel = savedCollectionNames.length === 1
          ? savedCollectionNames[0]
          : `${savedCollectionNames.slice(0, -1).join(', ')} and ${savedCollectionNames.at(-1)}`

        setSuccessModal({
          dramaTitle: selectedDrama.title,
          collectionName: collectionLabel,
          image: selectedDrama.image,
        })
        fetchCollections()
      }
    } catch (error) {
      console.error('Error saving:', error)
      showToast('Failed to save to collection.')
    } finally {
      setIsModalOpen(false)
      setSelectedDrama(null)
    }
  }

  const renameCollection = async (oldName) => {
    const newName = prompt(`Rename collection "${oldName}" to:`, oldName)
    if (!newName || newName.trim() === '' || newName === oldName) return

    try {
      const { error } = await supabase
        .from('favorites')
        .update({ collection_name: newName.trim() })
        .eq('user_id', session.user.id)
        .eq('collection_name', oldName)

      if (error) throw error
      fetchCollections()
      if (activeCollectionName === oldName) {
        setActiveCollectionName(newName.trim())
      }
      setCollectionMenuOpen(false)
      showToast(`Collection renamed to ${newName.trim()}!`)
    } catch (error) {
      console.error('Error renaming:', error)
      showToast('Failed to rename collection.')
    }
  }

  const deleteCollection = async (collectionName) => {
    const shouldDelete = confirm(`Delete "${collectionName}" and all dramas inside it?`)
    if (!shouldDelete) return

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', session.user.id)
        .eq('collection_name', collectionName)

      if (error) throw error
      setActiveCollectionName(null)
      setCollectionMenuOpen(false)
      fetchCollections()
      showToast(`${collectionName} deleted.`)
    } catch (error) {
      console.error('Error deleting collection:', error)
      showToast('Failed to delete collection.')
    }
  }

  const duplicateCollection = async (collectionName) => {
    const dramasToCopy = groupedCollections[collectionName] || []
    if (dramasToCopy.length === 0) return

    const newName = prompt(`Duplicate "${collectionName}" as:`, `${collectionName} Copy`)
    if (!newName || newName.trim() === '') return

    const insertData = dramasToCopy.map((drama) => ({
      user_id: session.user.id,
      drama_title: drama.drama_title,
      synopsis: drama.synopsis,
      image_url: drama.image_url,
      collection_name: newName.trim()
    }))

    try {
      const { error } = await supabase
        .from('favorites')
        .insert(insertData)

      if (error) throw error
      setActiveCollectionName(newName.trim())
      setCollectionMenuOpen(false)
      fetchCollections()
      showToast(`${collectionName} duplicated.`)
    } catch (error) {
      console.error('Error duplicating collection:', error)
      showToast('Failed to duplicate collection.')
    }
  }

  const deleteFavorite = async (id) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', id)
      if (error) throw error
      fetchCollections() // refresh list
    } catch (error) {
      console.error('Error deleting:', error)
    }
  }

  const visibleDramaCards = recommendations.length > 0 ? recommendations : popularDramas
  const relatedDramas = (recommendations.length > 0 ? recommendations : popularDramas)
    .filter((drama) => drama.title !== selectedDetailDrama?.title)

  return (
    <div className="main-content">
      {selectedDetailDrama ? (
        <div className="drama-detail-page">
          <div className="detail-topbar">
            <button className="back-btn" onClick={closeDramaDetail}>Back</button>
            <button className="save-btn detail-save-btn" onClick={() => openSaveModal(selectedDetailDrama)}>
              Save to Collection
            </button>
          </div>

          <div className="detail-hero">
            <img src={selectedDetailDrama.image} alt={selectedDetailDrama.title} className="detail-poster" />
            <div className="detail-copy">
              <p className="success-kicker">Drama synopsis</p>
              <h2>{selectedDetailDrama.title}</h2>
              <p>{selectedDetailDrama.synopsis}</p>
            </div>
          </div>

          <div className="related-dramas">
            <h3>{recommendations.length > 0 ? 'Other recommended dramas' : 'Other top Korean dramas'}</h3>
            <div className="related-link-grid">
              {relatedDramas.map((drama) => (
                <button key={drama.id || drama.title} className="related-drama-link" onClick={() => openDramaDetail(drama)}>
                  {drama.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <nav className="tabs">
            <button
              className={activeTab === 'search' ? 'active' : ''}
              onClick={() => {
                setActiveTab('search')
                setActiveCollectionName(null)
                setCollectionMenuOpen(false)
              }}
            >
              Discover
            </button>
            <button
              className={activeTab === 'collections' ? 'active' : ''}
              onClick={openCollections}
            >
              My Collections
            </button>
            <button className="logout-btn" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </button>
          </nav>

          {activeTab === 'search' && (
            <div className="search-view">
              <form onSubmit={handleSearch} className="search-form">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Enter drama"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="search-button">
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>

              {loading && <div className="loading-spinner"></div>}
              {error && <div className="error">{error}</div>}
              {!loading && popularError && recommendations.length === 0 && <div className="error">{popularError}</div>}
              {!loading && loadingPopular && recommendations.length === 0 && <div className="loading-spinner"></div>}

              {!loading && visibleDramaCards.length > 0 && (
                <>
                  {recommendations.length === 0 && (
                    <div className="popular-section-heading">
                      <p className="success-kicker">Top 20</p>
                      <h2>Popular Korean dramas</h2>
                    </div>
                  )}
                  <div className="recommendations-grid">
                    {visibleDramaCards.map((drama) => (
                      <div key={drama.id || drama.title} className="drama-card">
                        <button className="drama-image-button" onClick={() => openDramaDetail(drama)}>
                          <img src={drama.image} alt={drama.title} className="drama-image" />
                        </button>
                        <div className="drama-info">
                          <h3 className="drama-title">
                            <button className="drama-title-button" onClick={() => openDramaDetail(drama)}>
                              {drama.title}
                            </button>
                          </h3>
                          <p className="drama-synopsis">{drama.synopsis}</p>
                          <button className="save-btn" onClick={() => openSaveModal(drama)}>
                            Save to Collection
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'collections' && (
            <div className="collections-view">
              {!activeCollectionName && (
                <>
                  <h2>My Collections</h2>
                  {loadingCollections && <div className="loading-spinner"></div>}
                  {!loadingCollections && collections.length === 0 && (
                    <p className="no-results">You haven't saved any dramas yet.</p>
                  )}

                  {collectionFolders.length > 0 && (
                    <div className="folder-grid">
                      {collectionFolders.map(([colName, dramas]) => (
                        <button
                          key={colName}
                          className="folder-card"
                          onClick={() => openCollectionFolder(colName)}
                        >
                          <span className="folder-shape" aria-hidden="true"></span>
                          <span className="folder-name">{colName}</span>
                          <span className="folder-count">{dramas.length} {dramas.length === 1 ? 'drama' : 'dramas'}</span>
                          <span className="folder-preview">
                            {dramas.slice(0, 3).map((drama) => (
                              <img key={drama.id} src={drama.image_url} alt="" />
                            ))}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeCollectionName && (
                <div className="collection-page">
                  <button className="back-btn" onClick={closeCollectionFolder}>
                    Back to folders
                  </button>

                  <div className="collection-page-header">
                  <div>
                    <p className="success-kicker">Collection</p>
                    <h3 id="collection-title">{activeCollectionName}</h3>
                    <p className="collection-modal-count">
                      {activeCollectionDramas.length} {activeCollectionDramas.length === 1 ? 'drama' : 'dramas'}
                    </p>
                  </div>

                  <div className="collection-page-tools">
                    <button className="menu-dot-btn" onClick={() => setCollectionMenuOpen(!collectionMenuOpen)} aria-label="Collection actions">
                      ...
                    </button>
                    {collectionMenuOpen && (
                      <div className="collection-action-menu">
                        <button onClick={() => renameCollection(activeCollectionName)}>Rename</button>
                        <button onClick={() => duplicateCollection(activeCollectionName)}>Duplicate</button>
                        <button className="danger-action" onClick={() => deleteCollection(activeCollectionName)}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>

                  <div className="collection-page-grid">
                  {activeCollectionDramas.map((drama) => (
                    <div key={drama.id} className="collection-drama-card">
                      <button className="collection-drama-poster" onClick={() => openDramaDetail({
                        id: drama.id,
                        title: drama.drama_title,
                        synopsis: drama.synopsis,
                        image: drama.image_url,
                      })}>
                        <img src={drama.image_url} alt={drama.drama_title} />
                      </button>
                      <div>
                        <h4>
                          <button className="drama-title-button" onClick={() => openDramaDetail({
                            id: drama.id,
                            title: drama.drama_title,
                            synopsis: drama.synopsis,
                            image: drama.image_url,
                          })}>
                            {drama.drama_title}
                          </button>
                        </h4>
                        <p>{drama.synopsis}</p>
                        <button className="delete-btn" onClick={() => deleteFavorite(drama.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {isModalOpen && (() => {
        let existingCollections = [...new Set(collections.map(c => c.collection_name || 'My Collections'))]
        if (existingCollections.length === 0) existingCollections.push('My Collections')

        return (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Save to Collection</h3>

              <div className="collection-list">
                {existingCollections.map(cName => (
                  <label key={cName}>
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(cName)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCollections([...selectedCollections, cName])
                        } else {
                          setSelectedCollections(selectedCollections.filter(c => c !== cName))
                        }
                      }}
                    />
                    {cName}
                  </label>
                ))}
              </div>

              <div className="new-collection-field">
                <p>Create a new collection:</p>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection"
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button className="btn-save" onClick={handleSaveCollection}>Save</button>
              </div>
            </div>
          </div>
        )
      })()}

      {successModal && (
        <div className="modal-overlay">
          <div className="success-modal" role="dialog" aria-modal="true" aria-labelledby="success-title">
            {successModal.image && (
              <img src={successModal.image} alt="" className="success-poster" />
            )}
            <div>
              <p className="success-kicker">Added to collection</p>
              <h3 id="success-title">
                {successModal.dramaTitle} drama has been added to {successModal.collectionName}.
              </h3>
            </div>
            <button className="btn-save" onClick={() => setSuccessModal(null)}>Done</button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast-overlay">
          <div className="toast">{toastMessage}</div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [popularDramas, setPopularDramas] = useState([])
  const [loadingPopular, setLoadingPopular] = useState(false)
  const [popularError, setPopularError] = useState(null)
  const [selectedDetailDrama, setSelectedDetailDrama] = useState(null)

  useEffect(() => {
    let isCurrent = true

    const fetchPopularDramas = async () => {
      setLoadingPopular(true)
      setPopularError(null)

      try {
        const response = await fetch(getApiUrl('/api/popular-dramas'), {
          headers: {
            'Bypass-Tunnel-Reminder': 'true'
          }
        })

        if (!response.ok) {
          let message = `Backend returned ${response.status}.`
          try {
            const errorBody = await response.json()
            message = errorBody.detail || message
          } catch {
            // Some proxy/server errors are plain text instead of JSON.
          }
          throw new Error(message)
        }

        const data = await response.json()
        if (isCurrent) setPopularDramas(data)
      } catch (error) {
        console.error('Error fetching popular dramas:', error)
        if (isCurrent) setPopularError(error.message)
      } finally {
        if (isCurrent) setLoadingPopular(false)
      }
    }

    fetchPopularDramas()

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setSelectedDetailDrama(null)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setSelectedDetailDrama(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="app-container">
      <PosterMarquee
        dramas={popularDramas}
        onOpenDrama={session ? setSelectedDetailDrama : undefined}
      />

      <header>
        <h1>K-Drama Recommender</h1>
        <p className="subtitle">Find your next binge-watch based on your favorites.</p>
      </header>

      {!session ? (
        <Auth />
      ) : (
        <MainApp
          session={session}
          popularDramas={popularDramas}
          loadingPopular={loadingPopular}
          popularError={popularError}
          selectedDetailDrama={selectedDetailDrama}
          setSelectedDetailDrama={setSelectedDetailDrama}
        />
      )}
    </div>
  )
}

export default App
