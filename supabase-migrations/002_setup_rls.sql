-- RLS 策略设置：基于自定义请求头的用户隔离
-- 执行步骤：
-- 1. 在 Supabase Dashboard → SQL Editor 中执行此 SQL
-- 2. 必须在 001_add_user_id.sql 之后执行

-- ========================================
-- 第一步：创建获取请求头中 user_id 的函数
-- ========================================

CREATE OR REPLACE FUNCTION get_request_user_id()
RETURNS TEXT AS $$
BEGIN
  -- 尝试从自定义请求头中获取 user_id
  RETURN current_setting('request.headers.x-user-id', true);
EXCEPTION
  WHEN OTHERS THEN
    -- 如果获取失败，返回空字符串（会被 RLS 策略拒绝）
    RETURN '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 第二步：启用 RLS
-- ========================================

ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_locations ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 第三步：创建 pantry_items 的 RLS 策略
-- ========================================

-- 查看策略：用户只能看到自己的物品
CREATE POLICY "Users can only see their own items"
ON pantry_items FOR SELECT
USING (user_id = get_request_user_id());

-- 插入策略：用户只能插入自己的物品
CREATE POLICY "Users can only insert their own items"
ON pantry_items FOR INSERT
WITH CHECK (user_id = get_request_user_id());

-- 更新策略：用户只能更新自己的物品
CREATE POLICY "Users can only update their own items"
ON pantry_items FOR UPDATE
USING (user_id = get_request_user_id());

-- 删除策略：用户只能删除自己的物品
CREATE POLICY "Users can only delete their own items"
ON pantry_items FOR DELETE
USING (user_id = get_request_user_id());

-- ========================================
-- 第四步：创建 custom_locations 的 RLS 策略
-- ========================================

-- 查看策略：用户只能看到自己的位置
CREATE POLICY "Users can only see their own locations"
ON custom_locations FOR SELECT
USING (user_id = get_request_user_id());

-- 插入策略：用户只能插入自己的位置
CREATE POLICY "Users can only insert their own locations"
ON custom_locations FOR INSERT
WITH CHECK (user_id = get_request_user_id());

-- 更新策略：用户只能更新自己的位置
CREATE POLICY "Users can only update their own locations"
ON custom_locations FOR UPDATE
USING (user_id = get_request_user_id());

-- 删除策略：用户只能删除自己的位置
CREATE POLICY "Users can only delete their own locations"
ON custom_locations FOR DELETE
USING (user_id = get_request_user_id());

-- ========================================
-- 第五步：验证配置
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS 策略设置完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的策略：';
  RAISE NOTICE '- pantry_items: SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE '- custom_locations: SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 确保小程序在请求中发送 X-User-ID 请求头';
  RAISE NOTICE '2. 在 Supabase Dashboard → Settings → API → Request Headers';
  RAISE NOTICE '   添加 "X-User-ID" 到允许的请求头列表';
  RAISE NOTICE '========================================';
END $$;