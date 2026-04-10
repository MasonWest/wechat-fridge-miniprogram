// pages/index/index.js
const { 
  fetchItems, 
  addItem, 
  deleteItem, 
  isConfigured,
  fetchLocations,
  addLocation,
  updateLocation,
  deleteLocation,
  checkLocationUsage,
  saveSupabaseConfig,
  getSupabaseConfig
} = require('../../utils/supabase.js')

const { 
  getTodayString, 
  getItemStatus, 
  getExpiryText, 
  getLocationIcon 
} = require('../../utils/date.js')

Page({
  data: {
    items: [],
    customLocations: [],
    loading: true,
    isSupabaseConfigured: false,
    viewMode: 'list',
    userId: '', // 用户唯一ID
    
    // 表单数据
    form: {
      name: '',
      quantity: 1,
      expiry_date: getTodayString(),
      location: ''
    },
    
    // 系统默认位置
    defaultLocations: [
      { value: '冷藏', label: '❄ 冷藏', isDefault: true },
      { value: '冷冻', label: '🧊 冷冻', isDefault: true }
    ],
    
    // 筛选器位置选项（含"全部"）
    filterLocationOptions: [],
    
    // 添加表单位置选项（不含"全部"）
    formLocationOptions: [],
    
    // 所有位置（包含默认和自定义）
    allLocations: [],
    
    // 搜索和筛选
    searchQuery: '',
    selectedLocation: '全部',
    filteredItems: [],
    
    // 位置管理弹窗
    showLocationModal: false,
    newLocationName: '',
    editingId: null,
    editingName: '',
    
    // 设置弹窗
    showSettingsModal: false,
    settingsUrl: '',
    settingsKey: '',
    testing: false
  },

  onLoad() {
    this.getUserId() // 获取或生成用户ID
    this.checkConfig()
    this.loadItems()
    this.loadLocations()
  },

  onShow() {
    this.checkConfig()
  },

  checkConfig() {
    const configured = isConfigured()
    this.setData({ 
      isSupabaseConfigured: configured 
    })
    
    if (configured) {
      const { supabaseUrl, supabaseKey } = getSupabaseConfig()
      this.setData({
        settingsUrl: supabaseUrl,
        settingsKey: supabaseKey
      })
    }
  },

  // 获取或登录获取用户 open_id
  getUserId() {
    console.log('=== getUserId 开始 ===')
    let openId = wx.getStorageSync('open_id')
    console.log('从存储获取的 open_id:', openId)
    
    if (!openId) {
      // 如果没有 open_id，调用微信登录
      this.loginWechat()
    } else {
      console.log('已存在 open_id:', openId)
      this.setData({ userId: openId })
    }
  },

  // 微信登录获取 open_id
  async loginWechat() {
    console.log('=== 微信登录开始 ===')
    
    try {
      // 1. 调用 wx.login 获取 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })
      
      console.log('wx.login 获取到 code:', loginRes.code)
      
      if (!loginRes.code) {
        throw new Error('获取微信登录 code 失败')
      }
      
      // 2. 调用 Supabase Edge Function 换取 open_id
      const { supabaseUrl, supabaseKey } = require('../../utils/supabase.js').getSupabaseConfig()
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/wechat-login`
      
      console.log('请求 Edge Function URL:', edgeFunctionUrl)
      console.log('使用的 Supabase URL:', supabaseUrl)
      
      const result = await new Promise((resolve) => {
        wx.request({
          url: edgeFunctionUrl,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          data: { code: loginRes.code },
          success: (res) => {
            console.log('=== Edge Function 响应 ===')
            console.log('状态码:', res.statusCode)
            console.log('响应头:', res.header)
            console.log('响应数据:', res.data)
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ data: res.data, error: null })
            } else {
              const errorMsg = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
              resolve({ data: null, error: errorMsg || `HTTP ${res.statusCode}` })
            }
          },
          fail: (err) => {
            console.error('=== Edge Function 请求失败 ===')
            console.error('错误对象:', err)
            resolve({ data: null, error: err.errMsg || JSON.stringify(err) })
          }
        })
      })
      
      console.log('=== Edge Function 处理结果 ===')
      console.log('结果:', result)
      
      if (result.error) {
        console.error('Edge Function 返回错误:', result.error)
        throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error))
      }
      
      const openId = result.data.openid
      console.log('获取到 open_id:', openId)
      
      if (!openId) {
        throw new Error('未能获取到 open_id')
      }
      
      // 3. 存储 open_id
      wx.setStorageSync('open_id', openId)
      this.setData({ userId: openId })
      
      // 4. 重新加载数据
      this.loadItems()
      this.loadLocations()
      
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('=== 微信登录失败 ===')
      console.error('错误对象:', error)
      console.error('错误消息:', error.message)
      console.error('错误堆栈:', error.stack)
      
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      })
    }
  },

  // 更新位置选项
  updateLocationOptions() {
    const { customLocations, defaultLocations } = this.data
    
    const customOpts = customLocations.map(loc => ({
      value: loc.name,
      label: loc.name,
      id: loc.id,
      isDefault: false
    }))
    
    // 筛选器位置选项（含"全部"）
    const filterOpts = [
      { value: '全部', label: '全部' },
      ...defaultLocations,
      ...customOpts
    ]
    
    // 添加表单位置选项（不含"全部"）
    const formOpts = [
      ...defaultLocations,
      ...customOpts
    ]
    
    // 所有位置列表（用于位置管理弹窗）
    const allLocs = [
      ...defaultLocations,
      ...customOpts
    ]
    
    this.setData({
      filterLocationOptions: filterOpts,
      formLocationOptions: formOpts,
      allLocations: allLocs
    })
    
    // 设置默认选中位置
    if (formOpts.length > 0 && !this.data.form.location) {
      this.setData({
        'form.location': formOpts[0].value
      })
    }
  },

  // 加载物品列表
  async loadItems() {
    this.setData({ loading: true })
    const items = await fetchItems()
    
    console.log('加载物品结果:', items)
    
    if (!items || items.length === 0) {
      console.log('没有物品或加载失败')
    }
    
    // 处理每个物品的状态和显示文本
    const processedItems = items.map(item => ({
      ...item,
      status: getItemStatus(item.expiry_date),
      expiryText: getExpiryText(item.expiry_date),
      locationIcon: getLocationIcon(item.location)
    }))
    
    this.setData({ 
      items: processedItems,
      loading: false 
    })
    
    this.filterItems()
  },

  // 加载位置列表
  async loadLocations() {
    const locations = await fetchLocations()
    this.setData({ customLocations: locations })
    this.updateLocationOptions()
  },

  // 过滤物品
  filterItems() {
    const { items, searchQuery, selectedLocation } = this.data
    let result = items
    
    // 按位置筛选
    if (selectedLocation !== '全部') {
      result = result.filter(item => item.location === selectedLocation)
    }
    
    // 按名称搜索
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter(item => 
        item.name.toLowerCase().includes(query)
      )
    }
    
    this.setData({ filteredItems: result })
  },

  // ===== 表单相关 =====
  
  onInputName(e) {
    this.setData({ 'form.name': e.detail.value })
  },
  
  onInputQuantity(e) {
    const value = e.detail.value
    // 如果为空或只有负号，允许清空
    if (value === '' || value === '-') {
      this.setData({ 'form.quantity': value })
      return
    }
    // 转换为数字
    const num = parseInt(value)
    if (isNaN(num)) {
      this.setData({ 'form.quantity': 1 })
    } else {
      this.setData({ 'form.quantity': num })
    }
  },
  
  onExpiryDateChange(e) {
    this.setData({ 'form.expiry_date': e.detail.value })
  },
  
  selectLocation(e) {
    this.setData({ 'form.location': e.currentTarget.dataset.value })
  },
  
  async handleSubmit() {
    const { form, loading } = this.data
    
    if (!form.name.trim() || !form.expiry_date) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }
    
    // 校验数量不能为空
    if (!form.quantity || form.quantity === '') {
      wx.showToast({
        title: '请输入数量',
        icon: 'none'
      })
      return
    }
    
    const quantity = parseInt(form.quantity)
    if (isNaN(quantity) || quantity <= 0) {
      wx.showToast({
        title: '请输入有效的数量',
        icon: 'none'
      })
      return
    }
    
    if (loading) return
    
    this.setData({ loading: true })
    
    try {
      const { error } = await addItem({
        name: form.name.trim(),
        quantity: quantity,
        expiry_date: form.expiry_date,
        location: form.location,
        user_id: this.data.userId  // 添加 user_id 字段
      })
      
      if (error) {
        console.error('添加物品错误详情:', error)
        wx.showToast({
          title: '添加失败: ' + (error.message || error),
          icon: 'none',
          duration: 3000
        })
      } else {
        // 重置表单
        const formOpts = this.data.formLocationOptions
        this.setData({
          'form.name': '',
          'form.quantity': 1,
          'form.expiry_date': getTodayString(),
          'form.location': formOpts[0]?.value || '冷藏'
        })
        
        await this.loadItems()
        
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  // ===== 搜索和筛选 =====
  
  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value })
    this.filterItems()
  },
  
  clearSearch() {
    this.setData({ searchQuery: '' })
    this.filterItems()
  },
  
  selectFilterLocation(e) {
    this.setData({ selectedLocation: e.currentTarget.dataset.value })
    this.filterItems()
  },
  
  changeViewMode(e) {
    this.setData({ viewMode: e.currentTarget.dataset.mode })
  },

  // ===== 删除物品 =====
  
  confirmDelete(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    
    wx.showModal({
      title: '确认删除',
      content: `确定要将 "${name}" 标记为已吃完吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deleteItem(id)
        }
      }
    })
  },
  
  async deleteItem(id) {
    const { error } = await deleteItem(id)
    
    if (error) {
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    } else {
      await this.loadItems()
      wx.showToast({
        title: '已删除',
        icon: 'success'
      })
    }
  },

  // ===== 位置管理 =====
  
  openLocationModal() {
    this.setData({ showLocationModal: true })
  },
  
  closeLocationModal() {
    this.setData({ 
      showLocationModal: false,
      newLocationName: '',
      editingId: null,
      editingName: ''
    })
  },
  
  onNewLocationInput(e) {
    this.setData({ newLocationName: e.detail.value })
  },
  
  async addLocation() {
    const name = this.data.newLocationName.trim()
    if (!name) return
    
    const { error } = await addLocation(name, this.data.userId)  // 传递 user_id
    
    if (error) {
      console.error('添加位置错误详情:', error)
      wx.showToast({
        title: '添加失败: ' + (error.message || error),
        icon: 'none',
        duration: 3000
      })
    } else {
      this.setData({ newLocationName: '' })
      await this.loadLocations()
      
      // 选中新位置
      this.setData({ 'form.location': name })
    }
  },
  
  startEdit(e) {
    const location = e.currentTarget.dataset.location
    this.setData({
      editingId: location.value,
      editingName: location.label
    })
  },
  
  onEditNameInput(e) {
    this.setData({ editingName: e.detail.value })
  },
  
  async saveEdit() {
    const { editingId, editingName, allLocations } = this.data
    const newName = editingName.trim()
    
    if (!newName) {
      this.cancelEdit()
      return
    }
    
    const oldLoc = allLocations.find(l => l.value === editingId)
    if (!oldLoc || !oldLoc.id) {
      wx.showToast({
        title: '无法重命名',
        icon: 'none'
      })
      this.cancelEdit()
      return
    }
    
    const { error } = await updateLocation(oldLoc.id, newName)
    
    if (error) {
      wx.showToast({
        title: '重命名失败',
        icon: 'none'
      })
    } else {
      await this.loadLocations()
      this.setData({ 'form.location': newName })
    }
    
    this.cancelEdit()
  },
  
  cancelEdit() {
    this.setData({
      editingId: null,
      editingName: ''
    })
  },
  
  async deleteLocation(e) {
    const location = e.currentTarget.dataset.location
    
    if (location.isDefault) {
      wx.showToast({
        title: '默认位置不能删除',
        icon: 'none'
      })
      return
    }
    
    // 检查使用情况
    const usage = await checkLocationUsage(location.value)
    if (usage > 0) {
      wx.showToast({
        title: `该位置还有 ${usage} 件食材`,
        icon: 'none'
      })
      return
    }
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除位置 "${location.label}" 吗？`,
      success: async (res) => {
        if (res.confirm) {
          const { error } = await deleteLocation(location.id)
          
          if (error) {
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          } else {
            await this.loadLocations()
            
            // 如果删除的是当前选中的位置，重置
            if (this.data.form.location === location.value) {
              const formOpts = this.data.formLocationOptions
              this.setData({ 'form.location': formOpts[0]?.value || '冷藏' })
            }
            
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
          }
        }
      }
    })
  },

  // ===== 设置 =====
  
  openSettings() {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig()
    this.setData({
      showSettingsModal: true,
      settingsUrl: supabaseUrl,
      settingsKey: supabaseKey
    })
  },
  
  closeSettingsModal() {
    this.setData({ showSettingsModal: false })
  },
  
  onSettingsUrlInput(e) {
    this.setData({ settingsUrl: e.detail.value })
  },
  
  onSettingsKeyInput(e) {
    this.setData({ settingsKey: e.detail.value })
  },
  
  testConnection() {
    const { settingsUrl, settingsKey } = this.data
    
    if (!settingsUrl || !settingsKey) {
      wx.showToast({
        title: '请填写完整配置',
        icon: 'none'
      })
      return
    }
    
    this.setData({ testing: true })
    
    wx.request({
      url: `${settingsUrl}/rest/v1/`,
      method: 'GET',
      header: {
        'apikey': settingsKey,
        'Authorization': `Bearer ${settingsKey}`
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          wx.showToast({
            title: '连接成功',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: '连接失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        wx.showToast({
          title: '连接失败',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({ testing: false })
      }
    })
  },
  
  saveSettings() {
    const { settingsUrl, settingsKey } = this.data
    
    if (!settingsUrl || !settingsKey) {
      wx.showToast({
        title: '请填写完整配置',
        icon: 'none'
      })
      return
    }
    
    saveSupabaseConfig(settingsUrl, settingsKey)
    
    this.setData({
      showSettingsModal: false,
      isSupabaseConfigured: true
    })
    
    // 重新加载数据
    this.loadItems()
    this.loadLocations()
    
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    })
  },

  // 阻止事件冒泡
  preventBubble() {},

  // 复制用户ID
  copyUserId() {
    if (this.data.userId) {
      wx.setClipboardData({
        data: this.data.userId,
        success: () => {
          wx.showToast({
            title: '用户ID已复制',
            icon: 'success'
          })
        }
      })
    } else {
      wx.showToast({
        title: '用户ID为空',
        icon: 'none'
      })
    }
  }
})
