import Alpine from 'alpinejs'

Alpine.data('alert', function () {
  return {
    isVisible: false,
    dismiss() {
      this.isVisible = false
    },
    init() {
      setTimeout(() => {
        this.isVisible = true
      }, 80)
      setTimeout(() => {
        this.dismiss()
      }, 5000)
    },
  }
})

Alpine.data('unbanList', function () {
  return {
    pendingIp: null,
    ask(ip) {
      this.pendingIp = ip
    },
    cancel() {
      this.pendingIp = null
    },
  }
})

Alpine.start()
