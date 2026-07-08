/** Remove orphaned modal backdrops that can block clicks after route/auth changes. */
export function cleanupModalOverlays(): void {
  document.querySelectorAll('.modal-backdrop').forEach((element) => {
    element.remove()
  })
}
