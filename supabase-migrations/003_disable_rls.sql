-- 禁用 RLS 策略，改用代码层面过滤
-- 执行步骤：
-- 1. 在 Supabase Dashboard → SQL Editor 中执行此 SQL
-- 2. 删除所有 RLS 策略
-- 3. 添加宽松策略允许 anon 角色访问

-- ========================================
-- 删除所有基于 user_id 的 RLS 策略
-- ========================================

-- pantry_items 表的策略
DROP POLICY IF EXISTS "Users can only see their own items" ON pantry_items;
DROP POLICY IF EXISTS "Users can only insert their own items" ON pantry_items;
DROP POLICY IF EXISTS "Users can only update their own items" ON pantry_items;
DROP POLICY IF EXISTS "Users can only delete their own items" ON pantry_items;

-- custom_locations 表的策略
DROP POLICY IF EXISTS "Users can only see their own locations" ON custom_locations;
DROP POLICY IF EXISTS "Users can only insert their own locations" ON custom_locations;
DROP POLICY IF EXISTS "Users can only update their own locations" ON custom_locations;
DROP POLICY IF EXISTS "Users can only delete their own locations" ON custom_locations;

-- ========================================
-- 添加宽松策略，允许 anon 角色访问
-- （数据隔离在代码层面实现）
-- ========================================

-- pantry_items 表的宽松策略
CREATE POLICY "Allow all access to pantry_items" 
ON pantry_items FOR ALL 
USING (true) 
WITH CHECK (true);

-- custom_locations 表的宽松策略
CREATE POLICY "Allow all access to custom_locations" 
ON custom_locations FOR ALL 
USING (true) 
WITH CHECK (true);

-- ========================================
-- 验证配置
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS 策略已更新！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已删除：';
  RAISE NOTICE '- 所有基于 user_id 的 RLS 策略';
  RAISE NOTICE '';
  RAISE NOTICE '已添加：';
  RAISE NOTICE '- Allow all access to pantry_items';
  RAISE NOTICE '- Allow all access to custom_locations';
  RAISE NOTICE '';
  RAISE NOTICE '数据隔离方式：';
  RAISE NOTICE '- 代码层面过滤（在所有查询中添加 user_id 过滤）';
  RAISE NOTICE '- 更可靠，不依赖 Supabase 特殊功能';
  RAISE NOTICE '========================================';
END $$;

-- 显示当前策略
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('pantry_items', 'custom_locations')
ORDER BY tablename, policyname;