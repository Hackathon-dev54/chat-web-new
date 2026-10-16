import React, { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  MapPin,
  Store,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  LogIn,
} from 'lucide-react'
import type { HubMerchant, HubUser } from '../server/types'
import { StoreCard } from './StoreCard'

interface DiscoveryDirectoryProps {
  currentUser: HubUser | null
  refreshTrigger?: number
  onInquire: (merchant: HubMerchant) => void
  onOpenInMyChatze: (merchant: HubMerchant) => void
  onOpenRegisterStore: () => void
  onOpenGoogleLogin?: () => void
}

const CITIES = ['All', 'Kathmandu', 'Pokhara', 'Lalitpur', 'Bhaktapur', 'Biratnagar', 'Dharan', 'Butwal']
const CATEGORIES = ['All', 'Handicrafts', 'Clothing & Gear', 'Food & Groceries', 'Electronics', 'Jewelry & Gems']

export function DiscoveryDirectory({
  currentUser,
  refreshTrigger,
  onInquire,
  onOpenInMyChatze,
  onOpenRegisterStore,
  onOpenGoogleLogin,
}: DiscoveryDirectoryProps) {
  const [merchants, setMerchants] = useState<HubMerchant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCity, setSelectedCity] = useState('All')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const fetchMerchants = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (selectedCity !== 'All') params.set('city', selectedCity)
      if (selectedCategory !== 'All') params.set('category', selectedCategory)

      const res = await fetch(`/api/hub/directory?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMerchants(data.merchants || [])
      }
    } catch (err) {
      console.warn('Failed to fetch merchants from hub directory', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMerchants()
  }, [selectedCity, selectedCategory, refreshTrigger])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchMerchants()
  }

  const isFiltering = search.trim() !== '' || selectedCity !== 'All' || selectedCategory !== 'All'

  const handleResetFilters = () => {
    setSearch('')
    setSelectedCity('All')
    setSelectedCategory('All')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero Banner Section */}
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00a884]/10 border border-[#00a884]/30 text-[#00a884] text-xs font-semibold mb-4">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero-Middleman Sovereign Commerce across Nepal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
          Discover Local Sovereign Stores
        </h1>
        <p className="text-[#8696a0] text-sm sm:text-base leading-relaxed">
          Chat directly with verified business owners in Kathmandu, Pokhara & Lalitpur.
          No platform commission, no message surveillance, and zero middleman servers.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl p-4 mb-8 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8696a0] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by store name, craft, product or handle (e.g. woodcraft, pashmina, spices)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#8696a0] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-semibold text-xs px-6 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
        </form>

        {/* City Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
          <span className="text-[#8696a0] font-medium text-[11px] uppercase tracking-wider flex items-center gap-1 pl-1 pr-2">
            <MapPin className="w-3.5 h-3.5 text-[#00a884]" /> City:
          </span>
          {CITIES.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => setSelectedCity(city)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedCity === city
                  ? 'bg-[#00a884] text-[#111b21] font-bold shadow-sm'
                  : 'bg-[#182229] text-[#aebac1] hover:bg-[#202c33] border border-[#2a3942]'
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#222e35] text-xs">
          <span className="text-[#8696a0] font-medium text-[11px] uppercase tracking-wider flex items-center gap-1 pl-1 pr-2">
            <Filter className="w-3.5 h-3.5 text-[#00a884]" /> Category:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#00a884] text-[#111b21] font-bold shadow-sm'
                  : 'bg-[#182229] text-[#aebac1] hover:bg-[#202c33] border border-[#2a3942]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#8696a0]">
          <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Connecting to Chatze Hub Edge...</p>
        </div>
      ) : merchants.length === 0 ? (
        <div className="bg-[#111b21] border border-[#222e35] rounded-2xl p-10 text-center max-w-lg mx-auto shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#182229] border border-[#2a3942] flex items-center justify-center mx-auto mb-4 text-[#8696a0]">
            <Store className="w-7 h-7" />
          </div>

          {isFiltering ? (
            <>
              <h3 className="text-white font-bold text-base mb-1.5">No Matching Stores</h3>
              <p className="text-[#8696a0] text-xs leading-relaxed mb-5">
                No stores found matching your search or filters. Try clearing your filters to see all listed stores.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="bg-[#202c33] hover:bg-[#2a3942] text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-white font-bold text-base mb-1.5">No Stores Registered Yet</h3>
              <p className="text-[#8696a0] text-xs leading-relaxed mb-6">
                The Chatze Hub Sovereign Directory is clean and ready. Have you self-deployed your Chatze store?
                Sign in with Google and register your store URL to appear in the directory automatically!
              </p>

              {currentUser ? (
                <button
                  type="button"
                  onClick={onOpenRegisterStore}
                  className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold text-xs px-5 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>List Your Self-Deployed Store</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenGoogleLogin}
                  className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold text-xs px-5 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In with Google to List Store</span>
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#8696a0]">
              Showing <strong className="text-white">{merchants.length}</strong> verified sovereign store{merchants.length === 1 ? '' : 's'}
            </p>
            <button
              onClick={fetchMerchants}
              className="text-[#8696a0] hover:text-[#00a884] text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {merchants.map((merchant) => (
              <StoreCard
                key={merchant.id || merchant.handle}
                merchant={merchant}
                currentUser={currentUser}
                onInquire={onInquire}
                onOpenInMyChatze={onOpenInMyChatze}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
