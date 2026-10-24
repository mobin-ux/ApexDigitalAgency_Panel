/**
 * Uploads for the Panel v2 file pickers (New order brief, an order's Files tab,
 * a support request). Files go to `POST /api/uploads` the moment they are
 * chosen, so the customer sees each one land — or fail, with the reason — and
 * the form that eventually sends them only carries ids. A picker that shows a
 * chip for a file the server never stored is the defect three earlier phases
 * removed; a chip here means the file is on the server.
 */
export interface ApexUpload {
  id: string
  name: string
  size: number
}

export function useApexUploads() {
  const files = ref<ApexUpload[]>([])
  const uploading = ref(false)
  const error = ref('')

  async function add(list: FileList | File[] | null | undefined) {
    const chosen = Array.from(list ?? [])
    if (!chosen.length) {
      return
    }
    error.value = ''
    uploading.value = true
    try {
      // The endpoint takes five at a time; send in batches.
      for (let i = 0; i < chosen.length; i += 5) {
        const form = new FormData()
        for (const f of chosen.slice(i, i + 5)) {
          form.append('files', f, f.name)
        }
        const res = await $fetch<{ files: ApexUpload[] }>('/api/uploads', { method: 'POST', body: form })
        files.value.push(...res.files)
      }
    }
    catch (e) {
      error.value = errorMessage(e, 'That file did not upload. Please try again.')
    }
    finally {
      uploading.value = false
    }
  }

  function remove(id: string) {
    files.value = files.value.filter(f => f.id !== id)
  }

  function reset() {
    files.value = []
    error.value = ''
  }

  const ids = computed(() => files.value.map(f => f.id))

  return { files, uploading, error, add, remove, reset, ids }
}

/** "4.2 MB", "120 KB". */
export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
