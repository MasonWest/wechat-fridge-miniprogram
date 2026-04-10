// app.js
App({
  onLaunch() {
    // 检查是否配置了 Supabase
    this.checkSupabaseConfig()
  },

  checkSupabaseConfig() {
    const supabaseUrl = wx.getStorageSync('supabase_url') || ''
    const supabaseKey = wx.getStorageSync('supabase_anon_key') || ''
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('请在设置中配置 Supabase 环境变量')
    }
    
    return { supabaseUrl, supabaseKey }
  },

  // 全局数据
  globalData: {
    userInfo: null,
    supabaseUrl: '',
    supabaseKey: ''
  }
})
