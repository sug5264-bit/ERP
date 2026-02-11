import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FavoritesStore {
  favorites: { title: string; href: string }[]
  addFavorite: (item: { title: string; href: string }) => void
  removeFavorite: (href: string) => void
  isFavorite: (href: string) => boolean
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (item) =>
        set((state) => {
          if (state.favorites.some((f) => f.href === item.href)) return state
          return { favorites: [...state.favorites, item] }
        }),
      removeFavorite: (href) =>
        set((state) => ({
          favorites: state.favorites.filter((f) => f.href !== href),
        })),
      isFavorite: (href) => get().favorites.some((f) => f.href === href),
    }),
    { name: 'erp-favorites' }
  )
)
