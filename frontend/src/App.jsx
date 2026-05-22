import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const isDev = import.meta.env.DEV

const popularDramas = [
  {
    title: 'Queen of Tears',
    poster: 'https://image.tmdb.org/t/p/w342/7ZXLZ3KYL3IVvsSHBZaHjcNQzNU.jpg',
  },
  {
    title: 'Lovely Runner',
    poster: 'https://image.tmdb.org/t/p/w342/xJQyrif5M4UMoVBrBlwUabtaRxB.jpg',
  },
  {
    title: 'Extraordinary Attorney Woo',
    poster: 'https://image.tmdb.org/t/p/w342/zuNOQVI4rEaqwknrfQUVKtlKE2C.jpg',
  },
  {
    title: 'Moving',
    poster: 'https://image.tmdb.org/t/p/w342/vf9SNXNAFqzKBGksFwrXhkg9cb7.jpg',
  },
  {
    title: 'Crash Landing on You',
    poster: 'https://image.tmdb.org/t/p/w342/jTESfFcPm6TniFWpEBUnQnwtKTC.jpg',
  },
  {
    title: 'The Glory',
    poster: 'https://image.tmdb.org/t/p/w342/uUM4LVlPgIrww07OoEKrGWlS1Ej.jpg',
  },
  {
    title: 'King the Land',
    poster: 'https://image.tmdb.org/t/p/w342/tW8BMRCYSe6nySvZ749pzc31x2m.jpg',
  },
  {
    title: 'Hospital Playlist',
    poster: 'https://image.tmdb.org/t/p/w342/clYgUKk4CzmKpEukW2I2oDg9k1Q.jpg',
  },
  {
    title: 'Twenty Five Twenty One',
    poster: 'https://image.tmdb.org/t/p/w342/poJMfyThRcTRn3s8VIiJsBMVokd.jpg',
  },
]

function PosterMarquee() {
  const posters = [...popularDramas, ...popularDramas]

  return (
    <div className="poster-marquee" aria-label="Popular Korean drama posters">
      <div className="poster-track">
        {posters.map((drama, index) => (
          <div className="poster-tile" key={`${drama.title}-${index}`}>
            <img src={drama.poster} alt={`${drama.title} poster`} draggable="false" />
          </div>
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

function MainApp({ session }) {
  const [query, setQuery] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [activeTab, setActiveTab] = useState('search') // 'search' or 'collections'
  const [collections, setCollections] = useState([])
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [successModal, setSuccessModal] = useState(null)
  const [duplicatePrompt, setDuplicatePrompt] = useState(null)
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

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      if (!apiBaseUrl && !isDev) {
        throw new Error('Backend URL is not configured. Add VITE_API_BASE_URL in GitHub Pages secrets, then rerun the deploy workflow.')
      }

      const recommendationsUrl = `${apiBaseUrl}/api/recommendations?q=${encodeURIComponent(query)}`
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

  useEffect(() => {
    let isCurrent = true

    const preloadCollections = async () => {
      try {
        const { data, error } = await supabase
          .from('favorites')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        if (isCurrent) setCollections(data || [])
      } catch (error) {
        console.error('Error preloading collections:', error)
      }
    }

    preloadCollections()

    return () => {
      isCurrent = false
    }
  }, [])

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

  const buildSaveTargets = () => {
    const targets = new Set([...selectedCollections])
    if (newCollectionName.trim()) {
      targets.add(newCollectionName.trim())
    }

    if (targets.size === 0) {
      targets.add('My Collections')
    }

    return Array.from(targets)
  }

  const formatCollectionLabel = (collectionNames) => {
    if (collectionNames.length === 1) return collectionNames[0]
    return `${collectionNames.slice(0, -1).join(', ')} and ${collectionNames.at(-1)}`
  }

  const findExistingDramaCollection = (drama, collectionNames) => {
    const dramaTitle = drama.title.trim().toLowerCase()
    return collectionNames.find((collectionName) =>
      collections.some((collection) =>
        (collection.collection_name || 'My Collections') === collectionName &&
        collection.drama_title.trim().toLowerCase() === dramaTitle
      )
    )
  }

  const insertDramaIntoCollections = async (drama, collectionNames) => {
    const insertData = collectionNames.map(cName => ({
      user_id: session.user.id,
      drama_title: drama.title,
      synopsis: drama.synopsis,
      image_url: drama.image,
      collection_name: cName
    }))

    try {
      const { error } = await supabase
        .from('favorites')
        .insert(insertData)

      if (error) throw error

      setSuccessModal({
        dramaTitle: drama.title,
        collectionName: formatCollectionLabel(collectionNames),
        image: drama.image,
      })
      fetchCollections()
    } catch (error) {
      console.error('Error saving:', error)
      showToast('Failed to save to collection.')
    }
  }

  const handleSaveCollection = async () => {
    if (!selectedDrama) return

    const targets = buildSaveTargets()
    const duplicateCollectionName = findExistingDramaCollection(selectedDrama, targets)

    if (duplicateCollectionName) {
      setDuplicatePrompt({
        drama: selectedDrama,
        collectionNames: targets,
        collectionName: duplicateCollectionName,
      })
      setIsModalOpen(false)
      return
    }

    await insertDramaIntoCollections(selectedDrama, targets)
    setIsModalOpen(false)
    setSelectedDrama(null)
  }

  const confirmDuplicateSave = async () => {
    if (!duplicatePrompt) return
    const { drama, collectionNames } = duplicatePrompt
    setDuplicatePrompt(null)
    setSelectedDrama(null)
    await insertDramaIntoCollections(drama, collectionNames)
  }

  const cancelDuplicateSave = () => {
    setDuplicatePrompt(null)
    setSelectedDrama(null)
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

  return (
    <div className="main-content">
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

          {!loading && recommendations.length > 0 && (
            <div className="recommendations-grid">
              {recommendations.map((drama) => (
                <div key={drama.id} className="drama-card">
                  <img src={drama.image} alt={drama.title} className="drama-image" />
                  <div className="drama-info">
                    <h3 className="drama-title">{drama.title}</h3>
                    <p className="drama-synopsis">{drama.synopsis}</p>
                    <button className="save-btn" onClick={() => openSaveModal(drama)}>
                      Save to Collection
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                  <img src={drama.image_url} alt={drama.drama_title} />
                  <div>
                    <h4>{drama.drama_title}</h4>
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
                <p>Or create a new collection:</p>
                <input 
                  type="text" 
                  value={newCollectionName} 
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection name..."
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

      {duplicatePrompt && (
        <div className="modal-overlay">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
            <p className="success-kicker">Already saved</p>
            <h3 id="duplicate-title">
              This drama already exists in {duplicatePrompt.collectionName}. Do you still want to add it?
            </h3>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDuplicateSave}>No</button>
              <button className="btn-save" onClick={confirmDuplicateSave}>Yes</button>
            </div>
          </div>
        </div>
      )}

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
            <button className="btn-save" onClick={() => setSuccessModal(null)}>Lovely</button>
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

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="app-container">
      <PosterMarquee />

      <header>
        <h1>K-Drama Recommender</h1>
        <p className="subtitle">Find your next binge-watch based on your favorites.</p>
      </header>

      {!session ? <Auth /> : <MainApp session={session} />}
    </div>
  )
}

export default App
