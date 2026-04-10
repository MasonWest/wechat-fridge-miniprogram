// utils/supabase.js
// 微信小程序适配的 Supabase REST API 调用

// ===== 默认配置 =====
// 请替换为你的 Supabase 配置
// 获取方式：Supabase 仪表板 → Settings → API → Project API keys → anon public
const DEFAULT_SUPABASE_URL = 'https://fynnxolteexpcevodjia.supabase.co'
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bm54b2x0ZWV4cGNldm9kamlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTE1OTEsImV4cCI6MjA5MTAyNzU5MX0.FXcg5_f7O9C_V8QsASHB0FEtTdoAcm1G3w5ENZJ0EGk'

// 从本地存储获取配置，如果没配置则使用默认值
function getSupabaseConfig() {
  // 优先使用本地存储的配置
  let supabaseUrl = wx.getStorageSync('supabase_url')
  let supabaseKey = wx.getStorageSync('supabase_anon_key')
  
  // 如果没有本地配置，使用默认值
  if (!supabaseUrl) supabaseUrl = DEFAULT_SUPABASE_URL
  if (!supabaseKey) supabaseKey = DEFAULT_SUPABASE_KEY
  
  return { supabaseUrl, supabaseKey }
}

// 检查是否已配置
function isConfigured() {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig()
  return !!(supabaseUrl && supabaseKey)
}

// 发起请求的封装
function supabaseRequest(endpoint, method = 'GET', data = null) {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig()

  if (!supabaseUrl || !supabaseKey) {
    return Promise.resolve({ data: null, error: 'Supabase 未配置，请在设置中配置' })
  }

  return new Promise((resolve) => {
    console.log('=== Supabase Request ===')
    console.log('URL:', `${supabaseUrl}/rest/v1/${endpoint}`)
    console.log('Method:', method)
    console.log('Data:', data)

    wx.request({
      url: `${supabaseUrl}/rest/v1/${endpoint}`,
      method: method,
      header: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : 'return=minimal'
      },
      data: data,
      success(res) {
        console.log('=== wx.request success ===')
        console.log('Response Status:', res.statusCode)
        console.log('Response Data:', res.data)

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ data: res.data, error: null })
        } else {
          console.error('=== Supabase 请求失败 ===')
          console.error('状态码:', res.statusCode)
          console.error('错误响应:', res.data)
          resolve({ data: null, error: res.data || `HTTP ${res.statusCode}` })
        }
      },
      fail(err) {
        console.error('=== wx.request fail ===')
        console.error('网络请求失败:', err)
        resolve({ data: null, error: err.errMsg || '网络请求失败' })
      }
    })
  })
}

// 获取当前用户的 open_id
function getCurrentUserId() {
  return wx.getStorageSync('open_id') || ''
}

// 表格名称
const TABLE_NAME = 'pantry_items'
const LOCATIONS_TABLE = 'custom_locations'

/**
 * 获取所有物品，按过期时间升序排列
 */
async function fetchItems() {
  const userId = getCurrentUserId()
  if (!userId) return []
  const result = await supabaseRequest(`${TABLE_NAME}?select=*&user_id=eq.${userId}&order=expiry_date.asc`, 'GET')
  return result.data || []
}

/**
 * 添加新物品
 * @param {Object} item - 物品对象
 * @param {string} item.name - 物品名称
 * @param {number} item.quantity - 数量
 * @param {string} item.expiry_date - 过期日期 (YYYY-MM-DD)
 * @param {string} item.location - 存放位置
 */
async function addItem(item) {
  console.log('=== addItem 开始 ===')
  console.log('提交的数据:', JSON.stringify(item))
  
  const result = await supabaseRequest(TABLE_NAME, 'POST', [item])
  console.log('=== addItem 返回结果 ===')
  console.log('result:', result)
  console.log('result.error:', result.error)
  console.log('result.data:', result.data)
  
  if (result.error) {
    console.error('添加物品失败:', result.error)
    return { data: null, error: result.error }
  }
  
  // 兼容返回空数组的情况
  if (result.data === null || result.data === undefined) {
    console.warn('返回数据为空，可能请求失败了')
    return { data: null, error: '返回数据为空' }
  }
  
  return { data: result.data?.[0] || null, error: null }
}

/**
 * 删除物品
 * @param {number} id - 物品ID
 */
async function deleteItem(id) {
  const userId = getCurrentUserId()
  if (!userId) return { error: '未登录' }
  const result = await supabaseRequest(`${TABLE_NAME}?id=eq.${id}&user_id=eq.${userId}`, 'DELETE')
  if (result.error) {
    console.error('删除物品失败:', result.error)
    return { error: result.error }
  }
  return { error: null }
}

/**
 * 更新物品
 * @param {number} id - 物品ID
 * @param {Object} updates - 更新的字段
 */
async function updateItem(id, updates) {
  const userId = getCurrentUserId()
  if (!userId) return { data: null, error: '未登录' }
  const result = await supabaseRequest(`${TABLE_NAME}?id=eq.${id}&user_id=eq.${userId}`, 'PATCH', updates)
  if (result.error) {
    console.error('更新物品失败:', result.error)
    return { data: null, error: result.error }
  }
  return { data: result.data?.[0] || null, error: null }
}

// ===== 自定义存放位置 =====

/**
 * 获取所有自定义位置
 */
async function fetchLocations() {
  const userId = getCurrentUserId()
  if (!userId) return []
  const result = await supabaseRequest(`${LOCATIONS_TABLE}?select=*&user_id=eq.${userId}&order=name.asc`, 'GET')
  return result.data || []
}

/**
 * 添加自定义位置
 * @param {string} name - 位置名称
 * @param {string} userId - 用户 open_id
 */
async function addLocation(name, userId) {
  const result = await supabaseRequest(LOCATIONS_TABLE, 'POST', [{ name, user_id: userId }])
  if (result.error) {
    console.error('添加位置失败:', result.error)
    return { data: null, error: result.error }
  }
  return { data: result.data?.[0] || null, error: null }
}

/**
 * 删除自定义位置
 * @param {number} id - 位置ID
 */
async function deleteLocation(id) {
  const userId = getCurrentUserId()
  if (!userId) return { error: '未登录' }
  const result = await supabaseRequest(`${LOCATIONS_TABLE}?id=eq.${id}&user_id=eq.${userId}`, 'DELETE')
  if (result.error) {
    console.error('删除位置失败:', result.error)
    return { error: result.error }
  }
  return { error: null }
}

/**
 * 更新位置名称
 * @param {number} id - 位置ID
 * @param {string} name - 新名称
 */
async function updateLocation(id, name) {
  const userId = getCurrentUserId()
  if (!userId) return { data: null, error: '未登录' }
  const result = await supabaseRequest(`${LOCATIONS_TABLE}?id=eq.${id}&user_id=eq.${userId}`, 'PATCH', { name })
  if (result.error) {
    console.error('更新位置失败:', result.error)
    return { data: null, error: result.error }
  }
  return { data: result.data?.[0] || null, error: null }
}

/**
 * 检查位置是否被使用
 * @param {string} locationName - 位置名称
 * @returns {number} 使用数量
 */
async function checkLocationUsage(locationName) {
  const userId = getCurrentUserId()
  if (!userId) return 0
  const result = await supabaseRequest(`${TABLE_NAME}?location=eq.${encodeURIComponent(locationName)}&user_id=eq.${userId}&select=id`, 'GET')
  if (result.error) {
    console.error('检查位置使用失败:', result.error)
    return 0
  }
  return result.data?.length || 0
}

/**
 * 保存 Supabase 配置到本地存储
 */
function saveSupabaseConfig(url, key) {
  wx.setStorageSync('supabase_url', url)
  wx.setStorageSync('supabase_anon_key', key)
}

/**
 * 清除 Supabase 配置
 */
function clearSupabaseConfig() {
  wx.removeStorageSync('supabase_url')
  wx.removeStorageSync('supabase_anon_key')
}

module.exports = {
  isConfigured,
  fetchItems,
  addItem,
  deleteItem,
  updateItem,
  fetchLocations,
  addLocation,
  deleteLocation,
  updateLocation,
  checkLocationUsage,
  saveSupabaseConfig,
  clearSupabaseConfig,
  getSupabaseConfig
}
