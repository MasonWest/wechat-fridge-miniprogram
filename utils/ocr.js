// utils/ocr.js
// 腾讯云 OCR 封装（通过 Supabase Edge Function 调用）

/**
 * 调用腾讯云 OCR（通过 Edge Function）
 * @param {string} imageBase64 - 图片的 base64 编码（不带 data:image/xxx;base64, 前缀）
 * @returns {Promise<Object>} OCR 识别结果
 */
async function callTencentOCR(imageBase64) {
  try {
    // 从配置获取 Supabase URL
    const { supabaseUrl, supabaseKey } = require('./supabase.js').getSupabaseConfig()

    // 调用 Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/ocr-recognition`

    const result = await new Promise((resolve) => {
      wx.request({
        url: edgeFunctionUrl,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        data: {
          imageBase64: imageBase64
        },
        success: (res) => {
          console.log('=== OCR Edge Function 响应 ===')
          console.log('状态码:', res.statusCode)
          console.log('响应数据:', res.data)

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: res.data, error: null })
          } else {
            resolve({ data: null, error: res.data || `HTTP ${res.statusCode}` })
          }
        },
        fail: (err) => {
          console.error('=== OCR Edge Function 请求失败 ===')
          console.error('错误:', err)
          resolve({ data: null, error: err.errMsg || '请求失败' })
        }
      })
    })

    if (result.error) {
      console.error('OCR 调用失败:', result.error)
      return { data: null, error: result.error }
    }

    return { data: result.data, error: null }

  } catch (error) {
    console.error('OCR 调用异常:', error)
    return { data: null, error: error.message || '调用异常' }
  }
}

/**
 * 从 OCR 结果中提取商品名称
 * @param {Object} ocrResult - OCR 识别结果
 * @returns {string} 商品名称
 */
function parseProductName(ocrResult) {
  if (!ocrResult || !ocrResult.TextDetections) {
    return ''
  }

  const textDetections = ocrResult.TextDetections
  const allText = textDetections.map(item => item.DetectedText).join(' ')

  console.log('OCR 识别到的所有文本:', allText)

  // 常见商品名称关键词 - 更具体的关键词放在前面
  const productKeywords = [
    '产品名称',  // 最具体，放在第一位
    '商品名称',
    '品名',
    '商品名',
    '名称',
    '产品',
    '商品',
    '品项',
    '饼干', '面包', '牛奶', '酸奶', '饮料', '水',
    '方便面', '零食', '糖果', '巧克力',
    '油', '盐', '糖', '酱油', '醋',
    '米', '面', '粉', '调料'
  ]

  // 尝试提取商品名称
  for (const keyword of productKeywords) {
    // 修复正则表达式：匹配 [产品名称]产品 或 产品名称:产品
    const regex = new RegExp('(?:\\[' + keyword + '\\]|' + keyword + '[：:：]|' + keyword + '\\s+)([^\\[\\]：:：\\s]{2,15})', 'i')
    const match = allText.match(regex)
    if (match) {
      console.log('匹配到关键词 "' + keyword + '":', match[0], '提取:', match[1])
      return match[1].trim()
    }
  }

  // 如果没有找到，尝试取第一个较长的文本（可能是商品名）
  for (const item of textDetections) {
    const text = item.DetectedText.trim()
    if (text.length >= 2 && text.length <= 10 && /^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(text)) {
      console.log('兜底策略，使用:', text)
      return text
    }
  }

  return ''
}

/**
 * 从 OCR 结果中提取保质期并计算过期日期
 * 优先识别有效期天数（如"有效期2年"、"保质期720天"），从今天往后推算
 * @param {Object} ocrResult - OCR 识别结果
 * @returns {Object} { expiryDate: string }
 */
function parseExpiryDate(ocrResult) {
  if (!ocrResult || !ocrResult.TextDetections) {
    return { expiryDate: '' }
  }

  const allText = ocrResult.TextDetections.map(item => item.DetectedText).join(' ')
  console.log('OCR 识别到的所有文本（保质期解析）:', allText)

  const today = new Date()

  // 优先匹配：有效期 X 年（支持方括号、冒号等）
  let match = allText.match(/(?:\[?有效期\]?|[：:：\s]+)(\d+)\s*年/i)
  console.log('有效期匹配结果:', match)
  if (match) {
    const years = parseInt(match[1])
    const expiryDate = new Date(today)
    expiryDate.setFullYear(expiryDate.getFullYear() + years)
    console.log('计算出过期日期:', formatDate(expiryDate))
    return { expiryDate: formatDate(expiryDate) }
  }

  // 匹配：保质期 X 年
  match = allText.match(/(?:\[?保质期\]?|[：:：\s]+)(\d+)\s*年/i)
  console.log('保质期匹配结果:', match)
  if (match) {
    const years = parseInt(match[1])
    const expiryDate = new Date(today)
    expiryDate.setFullYear(expiryDate.getFullYear() + years)
    return { expiryDate: formatDate(expiryDate) }
  }

  // 匹配：有效期 X 天
  match = allText.match(/(?:\[?有效期\]?|[：:：\s]+)(\d+)\s*天/i)
  if (match) {
    const days = parseInt(match[1])
    const expiryDate = new Date(today)
    expiryDate.setDate(expiryDate.getDate() + days)
    return { expiryDate: formatDate(expiryDate) }
  }

  // 匹配：保质期 X 天
  match = allText.match(/(?:\[?保质期\]?|[：:：\s]+)(\d+)\s*天/i)
  if (match) {
    const days = parseInt(match[1])
    const expiryDate = new Date(today)
    expiryDate.setDate(expiryDate.getDate() + days)
    return { expiryDate: formatDate(expiryDate) }
  }

  // 兜底：直接识别到期日期（如"保质期至2026-04-15"、"有效期2026.04.15"）
  const datePatterns = [
    /保质期至\s*(\d{4}[-./年]\d{1,2}[-./月]\d{1,2})/,
    /有效期\s*(\d{4}[-./年]\d{1,2}[-./月]\d{1,2})/,
    /EXP[:：]\s*(\d{4}[-./年]\d{1,2}[-./月]\d{1,2})/,
    /过期\s*(\d{4}[-./年]\d{1,2}[-./月]\d{1,2})/
  ]

  for (const pattern of datePatterns) {
    match = allText.match(pattern)
    if (match) {
      const dateStr = match[1]
      const expiryDate = parseDateString(dateStr)
      if (expiryDate) {
        return { expiryDate: formatDate(expiryDate) }
      }
    }
  }

  return { expiryDate: '' }
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date - 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 解析日期字符串
 * @param {string} dateStr - 日期字符串
 * @returns {Date} 日期对象
 */
function parseDateString(dateStr) {
  // 移除中文分隔符
  const normalized = dateStr.replace(/[年月]/g, '-').replace(/日/g, '')

  // 解析日期
  const parts = normalized.split(/[-./]/)
  if (parts.length !== 3) {
    return null
  }

  const year = parseInt(parts[0])
  const month = parseInt(parts[1])
  const day = parseInt(parts[2])

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null
  }

  return new Date(year, month - 1, day)
}

module.exports = {
  callTencentOCR,
  parseProductName,
  parseExpiryDate
}