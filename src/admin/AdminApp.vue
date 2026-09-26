<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ExternalLink, GripVertical, LogOut, RotateCcw, Save, Settings2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 管理会话存储键与后台交互所需的响应式状态。
const sessionKey = "kiries-admin-session";
const config = ref(null);
const password = ref("");
const loginPassword = ref("");
const loginError = ref("");
const notice = ref("");
const loading = ref(true);
const saving = ref(false);
const rawMode = ref(false);
const rawConfig = ref("");
const rawError = ref("");
const original = ref("");
// 当前拖放项目的集合名称与源索引；拖放完成后立即清空。
const draggedItem = ref(null);
const isDirty = computed(() => {
  if (!config.value) return false;
  if (rawMode.value) return rawConfig.value !== JSON.stringify(JSON.parse(original.value), null, 2);
  return JSON.stringify(config.value) !== original.value;
});
const scalarFields = computed(() =>
  Object.entries(config.value || {}).filter(
    ([key, value]) =>
      !["brandMark", "brandMode", "favicon"].includes(key) &&
      !Array.isArray(value) &&
      (value === null || typeof value !== "object"),
  ),
);
const fieldGroups = computed(() => {
  const remaining = new Map(scalarFields.value);
  const groups = [
    {
      title: "页面设置",
      keys: [
        "pageTitle",
        "name",
        "Alias",
        "footerName",
        "eyebrow",
        "avatar",
        "footerUrl",
        "status",
        "siteStartedAt",
        "showContacts",
        "showSites",
        "siteKicker",
        "siteTitle",
        "siteDescription",
      ],
    },
    {
      title: "背景插图",
      keys: [
        "enableHitokoto",
        config.value?.enableHitokoto ? "hitokotoMaxLength" : "defaultIntro",
        "showHeroImage",
        "heroLayersEnabled",
        "heroImage",
        "enableBackgroundImage",
        "backgroundImage",
      ],
    },
  ].map((group) => ({
    title: group.title,
    fields: group.keys.filter((key) => remaining.has(key)).map((key) => [key, remaining.get(key)]),
  }));
  groups.push({ title: "快捷跳转", headerLinks: true, fields: [] });
  return groups.filter((group) => group.headerLinks || group.fields.length);
});

const fieldLabels = {
  pageTitle: "页面标题",
  brandMode: "Topbar",
  heroImage: "主页插画链接",
  showHeroImage: "显示主页插画",
  heroLayersEnabled: "启用三层图片效果",
  name: "名称",
  Alias: "Alias",
  eyebrow: "Eyebrow",
  avatar: "Avatar",
  status: "Status",
  enableHitokoto: "启用随机一言",
  hitokotoMaxLength: "一言最大长度",
  defaultIntro: "默认文案",
  enableBackgroundImage: "启用背景图片",
  backgroundImage: "背景图片链接",
  showSites: "显示站点入口",
  showContacts: "显示联系方式",
  siteKicker: "站点入口 Eyebrow",
  siteTitle: "站点入口标题",
  siteDescription: "站点入口说明",
  footerName: "页脚署名",
  footerUrl: "页脚链接",
  siteStartedAt: "站点运行时间",
  iconMode: "图标显示方式",
  iconUrl: "图标图片地址",
  mark: "文字图标",
  tone: "卡片颜色",
  enabled: "启用",
  description: "描述",
  href: "跳转链接",
  label: "名称",
  url: "跳转链接",
};

const fieldPlaceholders = {
  pageTitle: "标签页标题",
  name: "站点名称",
  Alias: "Alias",
  eyebrow: "Eyebrow",
  avatar: "头像 URL",
  status: "当前状态",
  footerName: "页脚署名",
  footerUrl: "粘贴署名跳转 URL",
  siteKicker: "站点入口 Eyebrow",
  siteTitle: "站点入口标题",
  siteDescription: "站点入口说明",
  hitokotoMaxLength: "一言最大字符数",
  defaultIntro: "默认文案",
  heroImage: "主页插画 URL",
  backgroundImage: "背景图片 URL",
  favicon: "ICON 链接",
  brandMark: "字标",
  label: "站点名称",
  href: "跳转 URL",
  iconUrl: "图标图片 URL",
  mark: "文字或符号",
  description: "入口描述",
  url: "联系方式 URL",
};

const toneOptions = [
  ["mint", "薄荷绿", "#b8f4db"],
  ["coral", "珊瑚橙", "#f4b39d"],
  ["rose", "玫瑰粉", "#eab2c7"],
  ["sky", "晴空蓝", "#9ed8ed"],
  ["lemon", "柠檬黄", "#e8e39d"],
  ["lavender", "薰衣草紫", "#cbb9eb"],
  ["blue", "湖水蓝", "#a8c9f4"],
  ["violet", "紫罗兰", "#c7afea"],
  ["orange", "橘子橙", "#f1bd82"],
  ["pearl", "珍珠白", "#d7e0dc"],
  ["aqua", "浅水青", "#98e5e6"],
  ["lime", "青柠绿", "#c6eb9b"],
  ["indigo", "靛青", "#aab8f2"],
  ["plum", "梅子紫", "#dda9d6"],
  ["sand", "暖沙色", "#e6cda4"],
  ["slate", "雾灰蓝", "#bec9d3"],
  ["teal", "湖绿", "#8bd6cb"],
  ["tangerine", "柑橘色", "#f3a475"],
  ["cyan", "青蓝", "#88dce5"],
  ["gold", "金色", "#f1d26b"],
  ["silver", "银灰", "#ccd2d5"],
  ["berry", "莓果粉", "#db92b8"],
];

/** 根据logo和背景图选项判断顶层配置字段是否显示。 */
function isFieldVisible(key) {
  if (key === "backgroundImage") return config.value.enableBackgroundImage;
  if (key === "defaultIntro") return !config.value.enableHitokoto;
  if (key === "hitokotoMaxLength") return config.value.enableHitokoto;
  if (["siteKicker", "siteTitle", "siteDescription"].includes(key)) {
    return config.value.showSites !== false;
  }
  if (key === "heroImage" || key === "heroLayersEnabled") return config.value.showHeroImage;
  return true;
}

/** 返回顶层字段在四列网格中的占位样式；key 是配置字段名。 */
function fieldClass(key) {
  return {
    "field-span-2": [
      "avatar",
      "footerUrl",
      "status",
      "siteStartedAt",
      "siteDescription",
      "heroImage",
      "backgroundImage",
    ].includes(key),
    "field-span-4": key === "enableBackgroundImage",
    "field-row-start": ["siteKicker", "showHeroImage", "heroImage"].includes(key),
    "field-align-center": key === "enableHitokoto",
  };
}

/** 根据图标模式过滤集合项目中当前不适用的字段。 */
function isItemFieldVisible(key, item) {
  if (key === "id" || key === "icon") return false;
  if (key === "iconUrl") return item.iconMode === "url";
  if (key === "mark") return item.iconMode === "text";
  return true;
}

/** 返回集合表单字段顺序，并将启用开关固定放在最后；item 为当前条目。 */
function itemFieldKeys(item) {
  return [...Object.keys(item).filter((key) => key !== "enabled"), "enabled"].filter((key) =>
    isItemFieldVisible(key, item),
  );
}

/** 将 ISO 日期转换为本地 datetime-local 控件可读的值。 */
function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

/** 将本地日期输入值转换为 ISO 字符串并写入配置。 */
function saveDateTime(key, value) {
  if (!value) return;
  updateField(key, new Date(value).toISOString());
}

/** 保留当前 schema 的未知字段，并确保三个可编辑集合始终为数组。 */
function normalizeConfig(value) {
  return {
    ...value,
    showContacts: value.showContacts !== false,
    heroImage: value.heroImage || "/alice.png",
    showHeroImage: value.showHeroImage !== false,
    heroLayersEnabled: value.heroLayersEnabled !== false,
    sites: Array.isArray(value.sites)
      ? value.sites.map((item) => ({ ...item, enabled: item.enabled !== false }))
      : [],
    contacts: Array.isArray(value.contacts)
      ? value.contacts.map((item) => ({ ...item, enabled: item.enabled !== false }))
      : [],
    headerLinks: Array.isArray(value.headerLinks) ? value.headerLinks : [],
  };
}

/** 从配置 API 读取站点数据，并使用指定管理密码认证。 */
async function requestConfig(secret = password.value) {
  const response = await fetch("/api/config", {
    headers: secret ? { "x-admin-password": secret } : {},
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 401 ? "管理密码错误" : "配置读取失败");
  return normalizeConfig(await response.json());
}

/** 同步配置对象、原始值快照和高级 JSON 编辑器内容。 */
function setConfig(value) {
  config.value = normalizeConfig(value);
  original.value = JSON.stringify(config.value);
  rawConfig.value = JSON.stringify(config.value, null, 2);
}

/** 将表单与高级 JSON 编辑器恢复为最近一次读取或成功保存的配置。 */
function resetChanges() {
  if (!isDirty.value) return;
  setConfig(JSON.parse(original.value));
  notice.value = "";
  rawError.value = "";
}

/** 验证登录密码并保存当前浏览器会话。 */
async function login() {
  loginError.value = "";
  try {
    const secret = loginPassword.value.trim();
    setConfig(await requestConfig(secret));
    password.value = secret;
    sessionStorage.setItem(sessionKey, secret);
    localStorage.setItem(sessionKey, secret);
  } catch (error) {
    loginError.value = error.message;
  }
}

/** 清除浏览器登录会话并返回登录状态。 */
function logout() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
  password.value = "";
  config.value = null;
  loading.value = false;
}

/** 校验并将表单或高级 JSON 配置保存到服务端。 */
async function save() {
  let payload = config.value;
  if (rawMode.value) {
    try {
      payload = normalizeConfig(JSON.parse(rawConfig.value));
      rawError.value = "";
    } catch (error) {
      rawError.value = `JSON 格式错误：${error.message}`;
      return;
    }
  }
  saving.value = true;
  notice.value = "";
  try {
    const response = await fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-admin-password": password.value },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      throw new Error(response.status === 401 ? "登录已失效，请重新登录" : "保存失败");
    setConfig(await response.json());
    notice.value = "配置已保存";
  } catch (error) {
    notice.value = error.message;
  } finally {
    saving.value = false;
  }
}

/** 更新配置对象中的一个顶层字段。 */
function updateField(key, value) {
  config.value[key] = value;
}

/** 更新指定配置集合中某个项目的字段。 */
function updateItem(collection, index, key, value) {
  config.value[collection][index][key] = value;
}

/** 将指定集合的源索引条目移动到目标索引，并原地更新配置。 */
function moveItem(collection, source, target) {
  if (source < 0 || target < 0 || source >= config.value[collection].length) return;
  const [item] = config.value[collection].splice(source, 1);
  config.value[collection].splice(Math.min(target, config.value[collection].length), 0, item);
}

/** 记录拖动事件中的集合名称与条目索引，并设置浏览器拖放传输数据。 */
function startItemDrag(collection, index, event) {
  draggedItem.value = { collection, index };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", `${collection}:${index}`);
}

/** 将拖动中的条目移动到目标位置并清理拖放状态。 */
function dropItem(collection, target) {
  const source = draggedItem.value;
  if (source?.collection === collection && source.index !== target) {
    moveItem(collection, source.index, target);
  }
  draggedItem.value = null;
}

/** 为指定集合追加一条符合当前 schema 的默认项目。 */
function addItem(collection) {
  config.value[collection].push(
    collection === "headerLinks"
      ? { label: "快捷访问", href: "https://", enabled: true }
      : collection === "sites"
        ? {
            name: "新站点",
            description: "",
            href: "https://",
            tone: "mint",
            enabled: true,
            iconMode: "text",
            iconUrl: "",
            mark: "新",
          }
        : {
            label: "联系方式",
            url: "https://",
            enabled: true,
            iconMode: "text",
            iconUrl: "",
            mark: "C",
          },
  );
}

/** 从指定配置集合中删除一个项目。 */
function removeItem(collection, index) {
  config.value[collection].splice(index, 1);
}

/** 为每个后台配置分类返回与侧栏导航对应的稳定锚点。 */
function sectionId(title) {
  return (
    {
      页面设置: "site-and-brand",
      背景插图: "homepage-settings",
    }[title] || "other-settings"
  );
}

/** 获取配置字段对应的中文显示名称。 */
function labelFor(key) {
  return fieldLabels[key] || key.replace(/([A-Z])/g, " $1");
}

/** 返回对应字段的简短填写提示；key 是配置字段名，item 为可选的集合条目。 */
function placeholderFor(key, item) {
  if (key === "iconUrl" && item?.iconMode === "url") return "图标图片 URL";
  if (key === "mark" && item?.iconMode === "text") return "文字或符号图标";
  return fieldPlaceholders[key] || "输入内容";
}

/** 返回与站点卡片色一致的后台图标预览样式。 */
function iconPreviewStyle(collection, item) {
  const option = toneOptions.find(([tone]) => tone === item.tone);
  return { backgroundColor: collection === "sites" ? option?.[2] || "#e4e9ed" : "#e4e9ed" };
}

watch(rawMode, (enabled) => {
  if (enabled && config.value) rawConfig.value = JSON.stringify(config.value, null, 2);
});

onMounted(async () => {
  document.title = "主页管理";
  const secret = localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || "";
  if (secret) {
    try {
      setConfig(await requestConfig(secret));
      password.value = secret;
    } catch {
      localStorage.removeItem(sessionKey);
      sessionStorage.removeItem(sessionKey);
    }
  }
  loading.value = false;
});
</script>

<template>
  <main class="admin-app">
    <div v-if="loading" class="admin-loading">正在验证管理会话…</div>
    <section v-else-if="!config" class="login-shell">
      <Card class="login-panel">
        <CardHeader>
          <CardTitle>管理后台</CardTitle>
          <CardDescription>登录后编辑站点内容与运行配置</CardDescription>
        </CardHeader>
        <CardContent>
          <form class="login-form" @submit.prevent="login">
            <Label for="admin-password">管理密码</Label>
            <Input
              id="admin-password"
              v-model="loginPassword"
              type="password"
              placeholder="请输入管理密码"
              autocomplete="current-password"
              autofocus
            />
            <p v-if="loginError" class="form-error" role="alert">{{ loginError }}</p>
            <Button type="submit">登录</Button>
          </form>
        </CardContent>
      </Card>
    </section>

    <template v-else>
      <header class="admin-topbar">
        <a class="admin-brand" href="/">{{ config.brandMark || config.name || "站点管理" }}</a>
        <span class="topbar-title">内容管理</span>
        <div class="topbar-actions">
          <Badge
            variant="secondary"
            :class="{ 'save-failed': rawError || (notice && notice !== '配置已保存') }"
            :title="rawError || notice || (isDirty ? '修改尚未保存' : '所有更改已保存')"
            role="status"
            aria-live="polite"
            >{{
              rawError || (notice && notice !== "配置已保存")
                ? "保存失败"
                : isDirty
                  ? "有未保存修改"
                  : "已同步"
            }}</Badge
          >
          <Button :disabled="!isDirty || saving" @click="save"
            ><Save />{{ saving ? "保存中…" : "保存更改" }}</Button
          >
          <Button variant="outline" as-child
            ><a href="/" target="_blank" rel="noreferrer">预览 <ExternalLink /></a
          ></Button>
          <Button variant="ghost" size="icon" aria-label="退出登录" title="退出登录" @click="logout"
            ><LogOut
          /></Button>
        </div>
      </header>

      <div class="admin-layout">
        <aside class="admin-nav" aria-label="编辑分区">
          <a href="#site-and-brand">页面设置</a>
          <a href="#homepage-settings">背景插图</a>
          <a href="#header-links">快捷跳转</a>
          <a href="#contacts">联系方式</a>
          <a href="#sites">站点入口</a>
        </aside>

        <div class="admin-content">
          <header class="page-heading">
            <div>
              <p>站点管理</p>
              <h1>主页设置</h1>
            </div>
            <div class="page-heading-actions">
              <Button variant="outline" :disabled="!isDirty" @click="resetChanges"
                ><RotateCcw />重置修改</Button
              >
              <Button variant="outline" @click="rawMode = !rawMode"
                ><Settings2 />{{ rawMode ? "返回表单" : "高级配置" }}</Button
              >
            </div>
          </header>

          <template v-if="!rawMode">
            <template v-for="group in fieldGroups" :key="group.title">
              <Card
                v-if="!group.headerLinks && !group.collection"
                :id="sectionId(group.title)"
                class="config-section"
              >
                <CardHeader>
                  <CardTitle>{{ group.title }}</CardTitle>
                </CardHeader>
                <CardContent class="config-grid">
                  <div
                    v-for="[key, value] in group.fields"
                    :key="key"
                    class="config-field"
                    :class="[
                      {
                        'config-field-brand': key === 'pageTitle',
                        'field-condition-hidden': !isFieldVisible(key),
                      },
                      fieldClass(key),
                    ]"
                  >
                    <template v-if="key === 'pageTitle'">
                      <div class="brand-row">
                        <div class="config-field">
                          <Label for="field-pageTitle">页面标题</Label>
                          <Input
                            id="field-pageTitle"
                            :model-value="value ?? ''"
                            :placeholder="placeholderFor(key)"
                            @update:model-value="updateField(key, $event)"
                          />
                        </div>
                        <div class="config-field">
                          <Label for="field-brandMode">Topbar</Label>
                          <Select
                            :model-value="config.brandMode"
                            @update:model-value="updateField('brandMode', $event)"
                          >
                            <SelectTrigger id="field-brandMode">
                              <SelectValue placeholder="选择样式" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">文字标识</SelectItem>
                              <SelectItem value="favicon">站点图标</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div v-if="config.brandMode === 'favicon'" class="config-field">
                          <Label for="field-favicon">ICON 链接</Label>
                          <Input
                            id="field-favicon"
                            v-model="config.favicon"
                            :placeholder="placeholderFor('favicon')"
                          />
                        </div>
                        <div class="config-field">
                          <Label for="field-brandMark">{{
                            config.brandMode === "favicon" ? "字标" : "字标"
                          }}</Label>
                          <Input
                            id="field-brandMark"
                            v-model="config.brandMark"
                            :placeholder="placeholderFor('brandMark')"
                          />
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <Label v-if="typeof value !== 'boolean'" :for="`field-${key}`">{{
                        labelFor(key)
                      }}</Label>
                      <div v-if="key === 'enableBackgroundImage'" class="switch-field">
                        <Switch
                          :id="`field-${key}`"
                          class="switch-control"
                          :model-value="value"
                          @update:model-value="updateField(key, $event)"
                        />
                        <Label :for="`field-${key}`">{{ labelFor(key) }}</Label>
                      </div>
                      <div v-else-if="typeof value === 'boolean'" class="switch-field">
                        <Switch
                          :id="`field-${key}`"
                          class="switch-control"
                          :model-value="value"
                          @update:model-value="updateField(key, $event)"
                        />
                        <Label :for="`field-${key}`">{{ labelFor(key) }}</Label>
                      </div>
                      <Textarea
                        v-else-if="
                          !['siteDescription', 'heroImage', 'backgroundImage'].includes(key) &&
                          String(value ?? '').length > 110
                        "
                        :id="`field-${key}`"
                        :model-value="value ?? ''"
                        rows="3"
                        :placeholder="placeholderFor(key)"
                        @update:model-value="updateField(key, $event)"
                      />
                      <Input
                        v-else-if="typeof value === 'number'"
                        :id="`field-${key}`"
                        :model-value="value"
                        type="number"
                        :placeholder="placeholderFor(key)"
                        @update:model-value="updateField(key, Number($event))"
                      />
                      <Input
                        v-else-if="key === 'siteStartedAt'"
                        :id="`field-${key}`"
                        :model-value="formatDateTime(value)"
                        type="datetime-local"
                        step="1"
                        :placeholder="placeholderFor(key)"
                        @update:model-value="saveDateTime(key, $event)"
                      />
                      <Input
                        v-else
                        :id="`field-${key}`"
                        :model-value="value ?? ''"
                        :placeholder="placeholderFor(key)"
                        @update:model-value="updateField(key, $event)"
                      />
                    </template>
                  </div>
                </CardContent>
              </Card>

              <Card v-else id="header-links" class="config-section">
                <CardHeader class="collection-heading">
                  <div>
                    <CardTitle>快捷跳转</CardTitle>
                    <CardDescription>{{ config.headerLinks.length }} 个条目</CardDescription>
                  </div>
                  <Button @click="addItem('headerLinks')">新增条目</Button>
                </CardHeader>
                <CardContent class="collection-list">
                  <Card
                    v-for="(item, index) in config.headerLinks"
                    :key="`${item.label}-${item.href}-${index}`"
                    class="collection-item"
                    :class="{
                      'is-dragging':
                        draggedItem?.collection === 'headerLinks' && draggedItem.index === index,
                    }"
                    @dragover.prevent
                    @drop.prevent="dropItem('headerLinks', index)"
                  >
                    <Collapsible>
                      <CardHeader class="item-heading">
                        <button
                          class="drag-handle"
                          type="button"
                          draggable="true"
                          :aria-label="`拖动快捷站点 ${index + 1} 排序`"
                          title="拖动排序"
                          @dragstart="startItemDrag('headerLinks', index, $event)"
                          @dragend="draggedItem = null"
                        >
                          <GripVertical />
                        </button>
                        <CollapsibleTrigger class="item-trigger item-trigger-compact">
                          <span class="item-title">{{
                            item.label || `快捷站点 ${index + 1}`
                          }}</span>
                          <span class="item-subtitle">{{ item.href || "尚未设置链接" }}</span>
                        </CollapsibleTrigger>
                        <div class="item-actions">
                          <Button variant="destructive" @click="removeItem('headerLinks', index)"
                            >删除</Button
                          >
                        </div>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent class="config-grid item-grid">
                          <div class="config-field">
                            <Label :for="`header-link-label-${index}`">名称</Label>
                            <Input
                              :id="`header-link-label-${index}`"
                              v-model="item.label"
                              aria-label="快捷站点名称"
                              :placeholder="placeholderFor('label')"
                            />
                          </div>
                          <div class="config-field">
                            <Label :for="`header-link-href-${index}`">链接</Label>
                            <Input
                              :id="`header-link-href-${index}`"
                              v-model="item.href"
                              aria-label="快捷站点链接"
                              :placeholder="placeholderFor('href')"
                            />
                          </div>
                          <div class="switch-field">
                            <Switch
                              :id="`header-link-enabled-${index}`"
                              class="switch-control"
                              :model-value="item.enabled"
                              @update:model-value="
                                updateItem('headerLinks', index, 'enabled', $event)
                              "
                            />
                            <Label :for="`header-link-enabled-${index}`">在首页显示</Label>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                </CardContent>
              </Card>
            </template>

            <Card
              v-for="collection in ['contacts', 'sites']"
              :id="collection"
              :key="collection"
              class="config-section"
            >
              <CardHeader class="collection-heading">
                <div>
                  <CardTitle>{{ collection === "sites" ? "站点入口" : "联系方式" }}</CardTitle
                  ><CardDescription>{{ config[collection].length }} 个条目</CardDescription>
                </div>
                <Button @click="addItem(collection)">新增条目</Button>
              </CardHeader>
              <CardContent class="collection-list">
                <Card
                  v-for="(item, index) in config[collection]"
                  :key="item.href || item.url || item.name || item.label || index"
                  class="collection-item"
                  :class="{
                    'is-dragging':
                      draggedItem?.collection === collection && draggedItem.index === index,
                  }"
                  @dragover.prevent
                  @drop.prevent="dropItem(collection, index)"
                >
                  <Collapsible>
                    <CardHeader class="item-heading">
                      <button
                        class="drag-handle"
                        type="button"
                        draggable="true"
                        :aria-label="`拖动${collection === 'sites' ? '站点入口' : '联系方式'} ${index + 1} 排序`"
                        title="拖动排序"
                        @dragstart="startItemDrag(collection, index, $event)"
                        @dragend="draggedItem = null"
                      >
                        <GripVertical />
                      </button>
                      <CollapsibleTrigger class="item-trigger">
                        <span
                          class="icon-preview"
                          :style="iconPreviewStyle(collection, item)"
                          aria-hidden="true"
                        >
                          <img
                            v-if="item.iconMode === 'url' && item.iconUrl"
                            :key="item.iconUrl"
                            :src="item.iconUrl"
                            alt=""
                            @error="$event.target.hidden = true"
                          />
                          <span v-else>{{ item.mark || "·" }}</span>
                        </span>
                        <span class="item-title">{{
                          item.name || item.label || `条目 ${index + 1}`
                        }}</span>
                        <span class="item-subtitle">{{
                          item.description || item.href || item.url || "尚未设置链接"
                        }}</span>
                      </CollapsibleTrigger>
                      <div class="item-actions">
                        <Button variant="destructive" @click="removeItem(collection, index)"
                          >删除</Button
                        >
                      </div>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent class="config-grid item-grid">
                        <div v-for="key in itemFieldKeys(item)" :key="key" class="config-field">
                          <Label
                            v-if="typeof item[key] !== 'boolean'"
                            :for="`item-${collection}-${index}-${key}`"
                          >
                            {{ labelFor(key) }}
                          </Label>
                          <div v-if="typeof item[key] === 'boolean'" class="switch-field">
                            <Switch
                              :id="`item-${collection}-${index}-${key}`"
                              class="switch-control"
                              :model-value="item[key]"
                              @update:model-value="updateItem(collection, index, key, $event)"
                            />
                            <Label :for="`item-${collection}-${index}-${key}`">
                              {{ labelFor(key) }}
                            </Label>
                          </div>
                          <Select
                            v-else-if="key === 'iconMode'"
                            :model-value="item[key]"
                            @update:model-value="updateItem(collection, index, key, $event)"
                          >
                            <SelectTrigger :id="`item-${collection}-${index}-${key}`"
                              ><SelectValue placeholder="选择图标显示方式"
                            /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="url">链接图标</SelectItem>
                              <SelectItem value="text">文字标识</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            v-else-if="key === 'tone'"
                            :model-value="item[key]"
                            @update:model-value="updateItem(collection, index, key, $event)"
                          >
                            <SelectTrigger :id="`item-${collection}-${index}-${key}`"
                              ><SelectValue placeholder="选择卡片颜色"
                            /></SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                v-for="[tone, title, color] in toneOptions"
                                :key="tone"
                                :value="tone"
                                :text-value="title"
                              >
                                <span class="tone-option">
                                  <i :style="{ backgroundColor: color }"></i>{{ title }}
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            v-else-if="typeof item[key] !== 'object'"
                            :id="`item-${collection}-${index}-${key}`"
                            :model-value="item[key] ?? ''"
                            :placeholder="placeholderFor(key, item)"
                            @update:model-value="updateItem(collection, index, key, $event)"
                          />
                          <Textarea
                            v-else
                            :id="`item-${collection}-${index}-${key}`"
                            :model-value="JSON.stringify(item[key], null, 2)"
                            :placeholder="placeholderFor(key, item)"
                            @update:model-value="
                              (value) => {
                                try {
                                  updateItem(collection, index, key, JSON.parse(value));
                                } catch {
                                  /* Edit complex values in advanced settings. */
                                }
                              }
                            "
                          />
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              </CardContent>
            </Card>
          </template>

          <Card v-else id="raw-config" class="config-section raw-section">
            <CardHeader
              ><CardTitle>高级配置</CardTitle
              ><CardDescription>编辑完整配置数据。修改前建议先备份。</CardDescription></CardHeader
            >
            <CardContent
              ><Textarea
                v-model="rawConfig"
                class="json-editor"
                placeholder="输入或粘贴完整 JSON 配置"
                spellcheck="false"
            /></CardContent>
          </Card>

          <Separator />
          <footer class="admin-footer">配置保存至服务端数据文件</footer>
        </div>
      </div>
    </template>
  </main>
</template>
