// 前端服务整合文件 - 支持本地直接打开

// ==================== StorageService ====================
class StorageService {
    constructor() {
        this.dbName = 'xiuxian_game';
        this.dbVersion = 2; // 升级版本以添加save_slots表
        this.db = null;
        this.maxSlots = 10; // 最大存档位数量
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB初始化失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB初始化成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('characters')) {
                    const characterStore = db.createObjectStore('characters', { keyPath: 'id', autoIncrement: true });
                    characterStore.createIndex('user_id', 'user_id', { unique: false });
                }

                if (!db.objectStoreNames.contains('sects')) {
                    db.createObjectStore('sects', { keyPath: 'id', autoIncrement: true });
                }

                if (!db.objectStoreNames.contains('items')) {
                    db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
                }

                if (!db.objectStoreNames.contains('inventory')) {
                    const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id', autoIncrement: true });
                    inventoryStore.createIndex('character_id', 'character_id', { unique: false });
                }

                if (!db.objectStoreNames.contains('game_progress')) {
                    db.createObjectStore('game_progress', { keyPath: 'character_id', unique: true });
                }

                // 新增 save_slots 存档位表
                if (!db.objectStoreNames.contains('save_slots')) {
                    const saveSlotStore = db.createObjectStore('save_slots', { keyPath: 'slot_id' });
                    saveSlotStore.createIndex('character_id', 'character_id', { unique: false });
                    saveSlotStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                console.log('IndexedDB升级完成');
            };
        });
    }

    _transaction(storeNames, mode, callback) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB未初始化'));
                return;
            }

            const transaction = this.db.transaction(storeNames, mode);
            const result = callback(transaction);

            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async saveCharacter(character) {
        return this._transaction(['characters'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('characters');
            store.put(character);
        });
    }

    async getCharacter(id) {
        return this._transaction(['characters'], 'readonly', (transaction) => {
            const store = transaction.objectStore('characters');
            const request = store.get(id);
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
        });
    }

    async getAllCharacters() {
        return this._transaction(['characters'], 'readonly', (transaction) => {
            const store = transaction.objectStore('characters');
            const request = store.getAll();
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
        });
    }

    async saveSects(sects) {
        return this._transaction(['sects'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('sects');
            sects.forEach(sect => store.put(sect));
        });
    }

    async getAllSects() {
        return this._transaction(['sects'], 'readonly', (transaction) => {
            const store = transaction.objectStore('sects');
            const request = store.getAll();
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
        });
    }

    async saveItems(items) {
        return this._transaction(['items'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('items');
            items.forEach(item => store.put(item));
        });
    }

    async getAllItems() {
        return this._transaction(['items'], 'readonly', (transaction) => {
            const store = transaction.objectStore('items');
            const request = store.getAll();
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
        });
    }

    async saveGameProgress(characterId, progress) {
        return this._transaction(['game_progress'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('game_progress');
            store.put({ character_id: characterId, ...progress });
        });
    }

    async getGameProgress(characterId) {
        return this._transaction(['game_progress'], 'readonly', (transaction) => {
            const store = transaction.objectStore('game_progress');
            const request = store.get(characterId);
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
        });
    }

    // ==================== 存档系统方法 ====================

    /**
     * 获取所有存档位
     * @returns {Promise<Array>} 存档位列表
     */
    async getAllSaveSlots() {
        return this._transaction(['save_slots'], 'readonly', (transaction) => {
            const store = transaction.objectStore('save_slots');
            const request = store.getAll();
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
            });
        });
    }

    /**
     * 保存存档
     * @param {number} slotId - 存档位ID (1-10)
     * @param {Object} saveData - 存档数据
     * @returns {Promise<void>}
     */
    async saveSlot(slotId, saveData) {
        if (slotId < 1 || slotId > this.maxSlots) {
            throw new Error(`存档位ID必须在1-${this.maxSlots}之间`);
        }

        const slot = {
            slot_id: slotId,
            character_id: saveData.character_id,
            character_name: saveData.character_name,
            location: saveData.location,
            game_days: saveData.game_days || 1,
            timestamp: Date.now(),
            memo: saveData.memo || '',
            // 完整的游戏数据
            game_data: saveData.game_data || {}
        };

        return this._transaction(['save_slots'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('save_slots');
            store.put(slot);
        });
    }

    /**
     * 读取存档
     * @param {number} slotId - 存档位ID
     * @returns {Promise<Object>} 存档数据
     */
    async loadSlot(slotId) {
        return this._transaction(['save_slots'], 'readonly', (transaction) => {
            const store = transaction.objectStore('save_slots');
            const request = store.get(slotId);
            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
        });
    }

    /**
     * 删除存档
     * @param {number} slotId - 存档位ID
     * @returns {Promise<void>}
     */
    async deleteSlot(slotId) {
        return this._transaction(['save_slots'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('save_slots');
            store.delete(slotId);
        });
    }

    /**
     * 更新存档备注
     * @param {number} slotId - 存档位ID
     * @param {string} memo - 新备注
     * @returns {Promise<void>}
     */
    async updateSlotMemo(slotId, memo) {
        const slot = await this.loadSlot(slotId);
        if (!slot) {
            throw new Error('存档位不存在');
        }
        slot.memo = memo;
        slot.timestamp = Date.now(); // 更新时间

        return this._transaction(['save_slots'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('save_slots');
            store.put(slot);
        });
    }

    /**
     * 导出存档为JSON文件
     * @param {number} slotId - 存档位ID
     * @returns {Promise<Object>} 包含下载链接的数据
     */
    async exportSlot(slotId) {
        const slot = await this.loadSlot(slotId);
        if (!slot) {
            throw new Error('存档位不存在');
        }

        const exportData = {
            version: '1.0',
            export_time: new Date().toISOString(),
            slot_data: slot
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 生成文件名：角色名_日期.yao
        const date = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
        const filename = `${slot.character_name}_${date}.yao`;

        return { url, filename, data: exportData };
    }

    /**
     * 导入存档
     * @param {Object} importData - 导入的存档数据
     * @param {number} targetSlotId - 目标存档位ID（可选，不指定则自动找空位）
     * @param {boolean} overwrite - 是否覆盖已有存档
     * @returns {Promise<Object>} 导入结果
     */
    async importSlot(importData, targetSlotId = null, overwrite = false) {
        // 验证数据格式
        if (!importData || !importData.slot_data) {
            throw new Error('无效的存档文件格式');
        }

        const slotData = importData.slot_data;

        // 验证必要字段
        if (!slotData.character_id || !slotData.character_name) {
            throw new Error('存档数据不完整');
        }

        let slotId = targetSlotId;

        // 如果没有指定目标存档位，找一个空位
        if (!slotId) {
            const existingSlots = await this.getAllSaveSlots();
            const usedIds = existingSlots.map(s => s.slot_id);

            // 找第一个空位
            for (let i = 1; i <= this.maxSlots; i++) {
                if (!usedIds.includes(i)) {
                    slotId = i;
                    break;
                }
            }

            if (!slotId) {
                throw new Error('存档位已满，请删除旧存档或选择覆盖');
            }
        }

        // 检查目标存档位是否已有存档
        const existingSlot = await this.loadSlot(slotId);
        if (existingSlot && !overwrite) {
            return {
                success: false,
                slotId: slotId,
                existingSlot: existingSlot,
                message: '该存档位已有存档，是否覆盖？'
            };
        }

        // 保存存档
        const newSlot = {
            slot_id: slotId,
            character_id: slotData.character_id,
            character_name: slotData.character_name,
            location: slotData.location,
            game_days: slotData.game_days || 1,
            timestamp: Date.now(),
            memo: slotData.memo || '(导入存档)',
            game_data: slotData.game_data || {}
        };

        await this._transaction(['save_slots'], 'readwrite', (transaction) => {
            const store = transaction.objectStore('save_slots');
            store.put(newSlot);
        });

        return {
            success: true,
            slotId: slotId,
            message: '存档导入成功'
        };
    }

    /**
     * 获取下一个可用的存档位ID
     * @returns {Promise<number|null>} 可用的存档位ID，如果没有则返回null
     */
    async getNextAvailableSlotId() {
        const existingSlots = await this.getAllSaveSlots();
        const usedIds = existingSlots.map(s => s.slot_id);

        for (let i = 1; i <= this.maxSlots; i++) {
            if (!usedIds.includes(i)) {
                return i;
            }
        }
        return null;
    }
}

// ==================== AIService ====================
class AIService {
    constructor() {
        // API提供商配置
        this.providers = {
            deepseek: {
                name: 'DeepSeek',
                url: 'https://platform.deepseek.com',
                apiUrl: 'https://api.deepseek.com/v1/chat/completions',
                models: ['deepseek-chat', 'deepseek-coder', 'deepseek-ai/deepseek-v3.1', 'deepseek-ai/deepseek-v3.1-terminus', 'deepseek-ai/deepseek-v3.2', 'deepseek-r1', 'deepseek-v3'],
                defaultModel: 'deepseek-chat',
                keyPrefix: 'deepseek'
            },
            openai: {
                name: 'OpenAI',
                url: 'https://platform.openai.com',
                apiUrl: 'https://api.openai.com/v1/chat/completions',
                models: ['gpt-4o', 'gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
                defaultModel: 'gpt-4o',
                keyPrefix: 'openai'
            },
            gemini: {
                name: 'Google Gemini',
                url: 'https://makersuite.google.com/app/apikey',
                apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-pro-preview-maxthinking', 'gemini-3-pro', 'gemini-3-flash'],
                defaultModel: 'gemini-2.5-pro',
                keyPrefix: 'gemini'
            },
            claude: {
                name: 'Claude',
                url: 'https://console.anthropic.com',
                apiUrl: 'https://api.anthropic.com/v1/messages',
                models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307', 'claude-opus-4-5', 'claude-opus-4-6', 'claude-sonnet-4-5'],
                defaultModel: 'claude-3-5-sonnet-20241022',
                keyPrefix: 'claude'
            },
            grok: {
                name: 'Grok',
                url: 'https://x.ai',
                apiUrl: 'https://api.x.ai/v1/chat/completions',
                models: ['grok-3', 'grok-3-fast', 'grok-3-mini', 'grok-3-thinking', 'grok-4', 'grok-4-expert', 'grok-4-fast', 'grok-4-fast-expert', 'grok-4-heavy', 'grok-4-mini', 'grok-4-thinking', 'grok-4.1', 'grok-4.1-expert', 'grok-4.1-fast', 'grok-4.1-mini', 'grok-4.1-thinking', 'grok-4.2o-beta', 'grokcs'],
                defaultModel: 'grok-3',
                keyPrefix: 'grok'
            },
            mistral: {
                name: 'Mistral',
                url: 'https://console.mistral.ai',
                apiUrl: 'https://api.mistral.ai/v1/chat/completions',
                models: ['labs-mistral-small-creative', 'mistral-large-2411', 'mistral-medium-latest', 'mistral-vibe-cli-latest'],
                defaultModel: 'mistral-large-2411',
                keyPrefix: 'mistral'
            },
            qwen: {
                name: 'Qwen',
                url: 'https://dashscope.aliyun.com',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                models: ['qwen/qwen-235b-a22b', 'qwen/qwq-32b'],
                defaultModel: 'qwen/qwen-235b-a22b',
                keyPrefix: 'qwen'
            },
            llama: {
                name: 'Llama',
                url: 'https://llama.meta.com',
                apiUrl: 'https://api.llama-api.com/chat/completions',
                models: ['meta-llama/llama-4-maverick-17b-128e-instruct'],
                defaultModel: 'meta-llama/llama-4-maverick-17b-128e-instruct',
                keyPrefix: 'llama'
            },
            other: {
                name: '其他模型',
                url: '',
                apiUrl: '',
                models: ['2411cs', 'devstral-latest', 'devstral-medium-latest', 'devstral-small-latest', 'glm-4.7', 'glmcs', 'ministral-14b-2512', 'nvcs', 'pixtral-large-2411', 'pixtral-large-latest'],
                defaultModel: 'devstral-latest',
                keyPrefix: 'other'
            },
            custom: {
                name: '自定义',
                url: '',
                apiUrl: '',
                models: [],
                defaultModel: '',
                keyPrefix: 'custom'
            }
        };

        // 加载API配置
        this.apiConfig = this._loadApiConfig();
        
        // 当前使用的API索引和提供商
        this.currentKeyIndex = 0;
        this.currentProvider = this.apiConfig.provider || 'deepseek';
        
        // 生成参数
        this.temperature = this.apiConfig.temperature || 0.7;
        this.maxTokens = this.apiConfig.maxTokens || 1000;
        
        // 重试配置
        this.maxRetries = 3;
        this.retryDelay = 1000;
        
        // API状态跟踪
        this.keyStatus = {}; // 记录每个key的状态: 'active' | 'failed' | 'rate_limited'
    }

    // 加载API配置
    _loadApiConfig() {
        // 为每个提供商创建5个key槽位
        const createDefaultKeys = (provider) => [
            { id: 1, name: '主Key', key: '', provider: provider, model: '' },
            { id: 2, name: '备用Key1', key: '', provider: provider, model: '' },
            { id: 3, name: '备用Key2', key: '', provider: provider, model: '' },
            { id: 4, name: '备用Key3', key: '', provider: provider, model: '' },
            { id: 5, name: '备用Key4', key: '', provider: provider, model: '' }
        ];
        
        const defaultConfig = {
            provider: 'deepseek',
            model: '', // 当前选中的模型
            keys: [
                ...createDefaultKeys('deepseek'),
                ...createDefaultKeys('openai'),
                ...createDefaultKeys('gemini'),
                ...createDefaultKeys('claude'),
                ...createDefaultKeys('grok'),
                ...createDefaultKeys('mistral'),
                ...createDefaultKeys('qwen'),
                ...createDefaultKeys('llama'),
                ...createDefaultKeys('other'),
                ...createDefaultKeys('custom')
            ],
            temperature: 0.7,
            maxTokens: 1000,
            customProvider: { name: '', apiUrl: '', models: [] }
        };
        
        const saved = localStorage.getItem('ai_api_config');
        console.log('从localStorage加载API配置:', saved ? '有保存的配置' : '无保存的配置');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                console.log('解析的API配置:', parsed);
                // 合并保存的配置，确保所有提供商的key都存在
                const mergedKeys = [...defaultConfig.keys];
                if (parsed.keys) {
                    parsed.keys.forEach(savedKey => {
                        const index = mergedKeys.findIndex(k => k.id === savedKey.id && k.provider === savedKey.provider);
                        if (index !== -1) {
                            mergedKeys[index] = { ...mergedKeys[index], ...savedKey };
                        }
                    });
                }
                const result = { ...defaultConfig, ...parsed, keys: mergedKeys };
                console.log('合并后的API配置keys数量:', result.keys.filter(k => k.key).length);
                return result;
            } catch (e) {
                console.error('加载API配置失败:', e);
            }
        }
        return defaultConfig;
    }

    // 保存API配置
    _saveApiConfig() {
        const configToSave = JSON.stringify(this.apiConfig);
        localStorage.setItem('ai_api_config', configToSave);
        console.log('API配置已保存到localStorage:', configToSave.substring(0, 200) + '...');
    }

    // 获取所有API配置
    getApiConfig() {
        return {
            provider: this.currentProvider,
            model: this.apiConfig.model,
            keys: this.apiConfig.keys,
            temperature: this.temperature,
            maxTokens: this.maxTokens,
            customProvider: this.apiConfig.customProvider,
            providers: this.providers
        };
    }

    // 更新API配置
    updateApiConfig(config) {
        console.log('AIService.updateApiConfig被调用:', config);
        if (config.provider) {
            this.currentProvider = config.provider;
            this.apiConfig.provider = config.provider;
        }
        if (config.model !== undefined) {
            this.apiConfig.model = config.model;
        }
        if (config.keys) {
            console.log('更新keys，新keys数量:', config.keys.filter(k => k.key).length);
            this.apiConfig.keys = config.keys;
        }
        if (config.temperature !== undefined) {
            this.temperature = config.temperature;
            this.apiConfig.temperature = config.temperature;
        }
        if (config.maxTokens !== undefined) {
            this.maxTokens = config.maxTokens;
            this.apiConfig.maxTokens = config.maxTokens;
        }
        if (config.customProvider) {
            this.apiConfig.customProvider = config.customProvider;
            this.providers.custom.apiUrl = config.customProvider.apiUrl || '';
            this.providers.custom.models = config.customProvider.models || [];
        }
        this._saveApiConfig();
        console.log('API配置已保存到localStorage，当前provider:', this.currentProvider);
    }

    // 获取当前有效的API Key
    _getCurrentKey() {
        const keys = this.apiConfig.keys.filter(k => k.key && k.provider === this.currentProvider);
        if (keys.length === 0) return null;
        
        // 优先使用主Key，如果失败则轮换
        for (let i = 0; i < keys.length; i++) {
            const index = (this.currentKeyIndex + i) % keys.length;
            const key = keys[index];
            const status = this.keyStatus[key.id] || 'active';
            
            if (status === 'active') {
                this.currentKeyIndex = index;
                return key;
            }
        }
        
        // 所有key都失败了，重置状态并返回第一个
        this.keyStatus = {};
        this.currentKeyIndex = 0;
        return keys[0];
    }

    // 标记Key失败
    _markKeyFailed(keyId) {
        this.keyStatus[keyId] = 'failed';
    }

    // 获取提供商信息
    getProviderInfo(provider) {
        return this.providers[provider] || this.providers.deepseek;
    }

    // 检查是否有可用的API Key
    hasApiKey() {
        const hasKey = this.apiConfig.keys.some(k => k.key && k.provider === this.currentProvider);
        console.log(`hasApiKey检查: provider=${this.currentProvider}, hasKey=${hasKey}, keys数量=${this.apiConfig.keys.filter(k => k.key && k.provider === this.currentProvider).length}`);
        return hasKey;
    }

    // 获取API Key状态
    getKeyStatus() {
        return this.apiConfig.keys.map(k => ({
            ...k,
            status: this.keyStatus[k.id] || 'active',
            hasKey: !!k.key
        }));
    }

    _buildSystemPrompt() {
        const staticData = window.gameApp?.getStaticData ? window.gameApp.getStaticData() : {};
        const sects = staticData.sects || [];
        const npcs = staticData.npcs || [];
        const realms = staticData.realms || [];
        
        // 构建门派信息
        const sectInfo = sects.map(s => {
            const buildings = s.buildings ? s.buildings.map(b => `    - ${b.name}：${b.description.substring(0, 50)}...`).join('\n') : '';
            const characters = s.characters ? s.characters.map(c => `    - ${c.name}（${c.title}）`).join('\n') : '';
            return `- ${s.name}（${s.country}国，${s.speciality}）\n  建筑：\n${buildings}\n  人物：\n${characters}`;
        }).join('\n\n');
        
        // 构建重要NPC信息（只包含高位和中位）
        const importantNpcs = npcs.filter(n => n.level === '高位' || n.level === '中位').map(n => {
            return `- ${n.name}，字${n.zi}（${n.sect} ${n.title}）\n  性格：${n.personality.substring(0, 30)}...\n  专长：${n.speciality.substring(0, 30)}...`;
        }).join('\n\n');
        
        // 构建界域信息（六界基本信息）
        const realmInfo = realms.map(r => {
            return `- ${r.name}：${r.description}`;
        }).join('\n');
        
        return `你是「爻」修仙文字游戏的剧情引擎。你的职责是推进剧情，而非介绍世界观。世界观是你写作的知识底座，不是你要告诉玩家的内容。

═══ 你的角色定位 ═══

你是一位全知的说书人，用文字带玩家走进六界。
玩家通过剧情体验世界，而不是通过你的介绍了解世界。
规则、势力、历史——这些只在剧情自然涉及时才出现，从不直接陈述。

═══ 玩家身份协议（最优先）════

【修仙者】（默认）
·可自由进入仙门各门派，接触仙门NPC等
·对修炼常识、灵力感知、门派规矩有基础认知
·AI以第三人称叙述，带入"修仙者视角"——对异常事件会自然用灵力/功法/仙门逻辑解释
·与仙门NPC初始好感+10，与凡人NPC初始好感不变
·不知朝堂秘辛、神君真相、器灵本质等深层秘密

【平民百姓】（后期解锁）
·无法直接进入门派内部，只能在门派外围活动
·可见NPC限于人间普通人、商贩、官府人员
·AI描写侧重人间烟火气——饮食、街市、劳作、节庆
·遭遇修仙事件时，以"不明所以"角度叙述：
  → 看到御剑飞过：以为是鸟或眼花
  → 听到仙门对话：听不清或听不懂
  → 进入仙家地界：莫名头晕/迷路/被"请走"
·与凡人NPC初始好感+10，与修仙者NPC无法正常互动（对方会刻意回避）

【天神下凡】（后期解锁）
·本体是天界天神，下凡后封印大部分法力，保留部分神格
·受天规限制：不可直接插手世间大事，不可暴露身份
·AI描写带有"神明视角"——能看透事物本质，但只能用凡人之躯行动
·对"秘密档案"中的真相有本能直觉（知道四方神执掌各国等），但不能明说
·与所有NPC初始好感不变，但高阶修行者会隐约感到"此人不同寻常"
·对幽都npc会有本能性的反感，且敌视幽都与南邺
·受天界监视：若违规使用神力，会有雷刑预警

【鬼魂】（后期解锁）
·已身死，魂魄状态，可进入幽都
·不可被普通人看见/听见/触碰
·只有通灵识者（特殊修行者、天生阴阳眼）可互动
·可附身（有限制）、可穿墙、可在鬼市交易（用功德）
·AI描写侧重"阴阳两隔"感——阳世喧嚣与自己无关，只有幽都才有同类
·与幽都NPC初始好感+20，与阳世NPC无法正常互动（对方若无通灵识则完全无视）

【妖族】（后期解锁）
·妖域出身，妖皇出走后结界开放，可自由进入人界
·在人间必须以人形示人，不可暴露妖身
·身份暴露有风险——可能被仙门追杀、被凡人恐惧
·AI描写带有"伪装者视角"——时刻注意言行是否像人，对天敌/克星敏感
·与妖族NPC初始好感+20，与仙门NPC初始好感-20（若身份暴露则敌对）
·可感知其他妖族的真实身份（对方也能感知你）

【身份认知边界规则】
AI根据玩家当前身份，判断"这个角色应该知道什么"。
当玩家询问超出身份认知的内容时，NPC会：
·表示不知/没听说过
·含糊其辞
·反问"你怎么会问这个"
·视好感度决定是否透露

═══ 世界观引出规则 ═══

世界观信息只能通过以下方式自然呈现：
·NPC对话中的随口提及
·环境细节描写
·事件中的意外发现
·玩家追问时的有限回应

例如：
『王大人，下官上朝半月，至今未见国君真容……』
『住口！』
茶盏重重一搁，王御史左右一瞥，声音压得极低：
『这话也是能问的？想死别拉着本官。』

═══ 结算协议（最优先读取）═══

每次回复末尾必须附加结算块，以空行与正文分隔，格式如下，
仅填写有实际内容的行，无内容的行整行省略：

【结算开始】
EVENT:预设事件名
ENCOUNTER:首次实质互动的NPC姓名
ITEM+:物品名×数量
ITEM-:物品名×数量
RELATION:NPC姓名+/-数值
LOCATION:界域·地区·具体地点
TIME+:时辰数
GOLD+:数量
GOLD-:数量
QUEST_START:任务名
QUEST_DONE:任务名
SKILL+:技能名·变化值
FLAG:标记名
【结算结束】

LOCATION每次必填，其余仅在有实际变化时填写。

═══ 称呼规则 ═══

好感度≥60：直呼其名，NPC自称"我"
好感度10-59：称字或称号，NPC自称"在下/本座"等
好感度<10：严格尊称，NPC自称符合身份者

═══ 语言风格 ═══

·简体中文，古风叙事体，第三人称全知视角
·禁止"你感到/你想到"等视角侵入写法
·对话以『』标注，与动作描写分段
·数值不外露：伤害/消耗用感官描写代替
·每段至少两种感官（视觉+听/嗅/触/温度之一）
·每段末尾留悬念钩子，至少一个选项与之呼应
·每段有明确情绪基调，末以意象句收束

═══ NPC对话风格（按性格标签）═══

消息灵通→自然带出情报，言语间显露消息来源广
爱八卦→难掩兴奋，主动打听追问
守口如瓶→措辞谨慎，话少，不主动透露
记仇→细节处藏旧事提醒，态度因旧怨而微妙
护短→涉及自己人立刻警觉，言辞中有维护之意
慕强→对实力肯定显而易见，对弱者不自觉轻视
不近人情→话语直接，不留情面，不做客套
自来熟→见面即闲聊，热络自然，无距离感
话多者（如洛尘）→句子连绵，随口带玩笑，常反问
寡言者（如苏御）→只说要点，句短，动作多于台词
刚直者（如卫烈霜）→陈述句为主，言出必行
温润者（如沈兆元）→措辞周全，情绪藏在细节里

═══ 剧情推进规则 ═══

·必须结合玩家输入推进剧情，不可忽略玩家行动
·玩家输入"开始"时，从角色当前位置和状态开场，不介绍世界背景
·每次回复是新的剧情进展，不重复之前内容
·开场不做世界观介绍，直接进入场景
·世界规则、势力关系只在剧情自然触及时透过场景/对话/事件呈现

═══ 输出格式 ═══

【分段硬性要求】
▸每段不超过150字，超过必须换行分段
▸段落间以空行隔开
▸对话独立成段，不与动作描写混在同一段
▸环境/氛围描写独立成段

剧情正文（${Math.floor(this.maxTokens * 0.6)}-${Math.floor(this.maxTokens * 0.8)}字，根据max_tokens=${this.maxTokens}动态调整）
[空行]
选项列表：2-4个选项，具体可行，符合当前剧情
[空行]
【结算开始】
...
【结算结束】

═══ 世界知识库 ═══

【六界格局与规则】
天界：天神居九重天，神力源自天道，天道近来式微。天规限制天神不可直接插手世间，
  下凡须封印法力，违规受雷刑。天神入梦术每月一次，仅对一人，一盏茶时长，不稳定。
人间三国：玄北国（雪山极寒，男尊）；西刹国（迷雾森林，木系法术）；东澜国（滨海，女尊，贸易发达）。
  南邺已被浑渊占领，国君已死，浑渊被封印于赤山无法外出，表面繁荣实则高压。

【秘密档案 · 绝对禁止直接表露】
以下内容只能通过剧情中的只言片语、细节暗示、NPC对话等方式间接呈现，
严禁在任何时候直接向玩家陈述或解释。这些秘密是世界的底层设定，需要玩家自行拼凑。

▸玄北秘辛：
  ·执明神君以凡人国君身份统治玄北国，万民不知其为神
  ·执明神君因违背天道，受天道法则惩戒，困于童身无法公开上朝
  ·朝堂上以乞丐充当台面国君代为出席
  ·执明神君藏于帘后，以传音实时指挥朝政
  ·玄明阁实为执明神君处理政务之所，童身期间以传音遥控乞丐，实权从未旁落
  ·执明神君以童身镇于宫内时，乞丐藏于帘后代为上朝，此事仅极少数人知晓（仅乞丐、神君本人、丞相知晓）
  ·宫中有一间偏殿长年上锁，据说关押着一名被执明神君接入宫内的乞丐，用以应对朝臣察觉帘后之事的应急之策
  ·国政决策权始终未离其手
  【呈现方式】：可通过朝堂上的异常（帘后有人影、声音从不知何处传来、
  国君眼神呆滞却决策精准等细节暗示），不可直接说明真相

▸人世间秘辛：
  ·婚俗：祖上传言若村人与外人成亲将有大火焚村，故严格执行村内通婚制度
  ·秘密：人世间的气候异常从未被官府正式解释，民间有多种传说，均属禁止讨论的话题

▸神君秘辛：
  ·玄北国由执明神君执掌（凡人不知其为神）
  ·西刹国由监兵神君执掌
  ·东澜国由孟章神君执掌
  ·南邺原由陵光神君执掌，现被浑渊占领
  ·陵光神君被囚于南邺，对外宣称已死，实被浑渊囚禁
  【呈现方式】：通过NPC对话提及"当年国君已死"等说法，
  或南邺的异常现象暗示神君未死，不可直接说明真相

▸器灵秘辛：
  ·神器器灵实为初代天神，因沾染天道灵气而生
  ·逐月楼楼主本质是器灵（初代天神），主人已亡故，可自主行动
  ·天道本身是初代天神，现为世界规则的化身
  【呈现方式】：
  ·神器器灵：通过古怪言行、超越时代的认知、对天道的特殊感应等细节暗示
  ·逐月楼楼主：通过其深沉心思、不符青楼楼主身份的阅历、对各界秘辛的了如指掌、
    以及那种看透世事的淡然态度等细节暗示，不可直接说明真相

▸幽都秘辛：
  ·冥君表面投靠浑渊，实为保护天帝
  ·冥君与浑渊的合作是假象，暗中守护天道传承
  【呈现方式】：通过冥君行为的矛盾之处、对特定人物的特殊关照、
  幽都的暗中布局等细节暗示，不可直接说明真相

▸仙门秘辛：
  ·暗阁是衢府旗下的暗杀组织，对外不公开隶属关系
  ·衢府通过暗阁处理不便公开的事务
  【呈现方式】：通过暗阁成员对衢府的特殊态度、
  任务来源的暗示、令牌上的细微标记等细节暗示

▸珍宝阁秘辛：
  ·珍宝阁（洪/荒）本质是其他世界的穿越者
  ·洪与荒来自不同的异世界，因特殊原因滞留此界
  ·他们对此界了如指掌，四处游荡是爱好，贩卖珍宝是兴趣
  ·所售珍宝多非此界原有之物，来自他们的原世界
  ·偶尔会说出此界没有的现代词汇，然后以"说笑了"掩饰
  【呈现方式】：通过他们偶尔蹦出的现代词汇（如"性价比""包邮"等）、
  对此界常识的过度了解、所售物品的异样（如机械结构、未知材质）、
  以及那种"明明很懂却装作不懂"的微妙态度等细节暗示

═══ 秘密呈现规则（通用） ═══

秘密的接入需要层层递进
·外层：人人都能看到的异常现象
·中层：少数人知道的传闻/猜测
·核心：极少数人知道的真相

AI根据NPC身份+玩家进度，决定透露哪一层，且确保NPC所知信息受其身份限制：

【外层·可见异常】
- 任何身份都可感知
- 例：紫光选婴
- 呈现方式：环境描写/路人随口一提

【中层·有限知情】
- 只有相关身份+一定条件才知
- 例：低阶官员知"帘后有声音"，不知声音来源
- 呈现方式：当事人私下议论、欲言又止、被人打断

【核心·真相】
- 只有极少数人+深度信任/特殊事件才透露
- 例：神君是神、乞丐假国君、传音指挥
- 呈现方式：生死关头、救命之恩、酒后失言、密室对话

【核心原则】
NPC永远不说超出自己身份+与玩家关系程度的信息。
玩家要靠自己：观察异常 → 找到知情者 → 赢得信任 → 获得真相。

仙门：衢府（蓬莱仙岛，持乾令者方可入）、阆阙（除灵师协会，东澜）、
  暗阁（神秘暗杀组织，来历不明）。四大门派：沁雨阁（西刹，炼丹医术）、
  御桓派（玄北，炼器）、溟安门（驭兽）、祢听观（卜策）。
幽都：鬼市（亡魂聚居，功德为货币）。冥君已带鬼差投奔浑渊，幽都人心动荡。
妖域：妖皇出走结界已开，治安混乱。大妖守岛，小妖散于四国。

【势力关系】
天界与南邺对立，幽都投靠浑渊
仙门与妖域对立（仙门曾大肆捕妖）。妖域与人间早有摩擦。
逐月楼（苍斛街青楼）：各界情报枢纽，与南邺有合作，不直接参与争斗。
乾胤阁：财神所设，各界有分行，南邺分行已关闭，溯洄轮可跨分行传送。
珍宝阁（洪/荒）：四处游荡的奸商。

【货币与特殊生灵】
灏坤石：六界通用货币。功德：幽都专用，可等比兑换灏坤石。
灵宠：吸收天地灵力的生灵，需与主人签约。
器灵：高品阶武器所生的意识。

【门派势力详情】
${sectInfo}

【重要人物】
${importantNpcs}`;

    }

    async _withRetry(fn, retries = this.maxRetries) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this._withRetry(fn, retries - 1);
            }
            throw error;
        }
    }

    async generateResponse(prompt, context = [], character = null, currentLocation = null, currentNPC = null, timeInfo = null) {
        const apiKey = this._getCurrentKey();
        if (!apiKey) {
            const providerInfo = this.getProviderInfo(this.currentProvider);
            throw new Error(`请先配置${providerInfo.name}的API密钥`);
        }

        const fullPrompt = this._buildFullPrompt(prompt, character, currentLocation, currentNPC, timeInfo);
        const providerInfo = this.getProviderInfo(this.currentProvider);
        const model = apiKey.model || providerInfo.defaultModel;

        // 根据提供商构建请求
        let requestParams;
        let apiUrl = providerInfo.apiUrl;
        let headers = {};
        let body;

        switch (this.currentProvider) {
            case 'gemini':
                // Gemini API格式
                apiUrl = apiUrl.replace('{model}', model);
                requestParams = {
                    contents: [
                        { role: 'user', parts: [{ text: this._buildSystemPrompt() }] },
                        ...context.map(c => ({ role: c.role === 'assistant' ? 'model' : 'user', parts: [{ text: c.content }] })),
                        { role: 'user', parts: [{ text: fullPrompt }] }
                    ],
                    generationConfig: {
                        temperature: this.temperature,
                        maxOutputTokens: this.maxTokens
                    }
                };
                headers = { 'Content-Type': 'application/json' };
                apiUrl += `?key=${apiKey.key}`;
                body = JSON.stringify(requestParams);
                break;

            case 'claude':
                // Claude API格式
                requestParams = {
                    model: model,
                    max_tokens: this.maxTokens,
                    temperature: this.temperature,
                    system: this._buildSystemPrompt(),
                    messages: [
                        ...context,
                        { role: 'user', content: fullPrompt }
                    ]
                };
                headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey.key,
                    'anthropic-version': '2023-06-01'
                };
                body = JSON.stringify(requestParams);
                break;

            case 'grok':
            case 'mistral':
            case 'qwen':
            case 'llama':
            case 'other':
            case 'custom':
            case 'openai':
            case 'deepseek':
            default:
                // OpenAI兼容格式
                requestParams = {
                    model: model,
                    messages: [
                        { role: 'system', content: this._buildSystemPrompt() },
                        ...context,
                        { role: 'user', content: fullPrompt }
                    ],
                    max_tokens: this.maxTokens,
                    temperature: this.temperature
                };
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey.key}`
                };
                body = JSON.stringify(requestParams);
                break;
        }

        // 尝试请求，支持Key轮换
        let lastError;
        const maxKeyAttempts = 3;

        for (let attempt = 0; attempt < maxKeyAttempts; attempt++) {
            const currentKey = this._getCurrentKey();
            if (!currentKey) break;

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers,
                    body
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMsg = errorData.error?.message || `API请求失败: ${response.status}`;
                    
                    // 如果是认证错误或速率限制，标记当前key失败并尝试下一个
                    if (response.status === 401 || response.status === 429) {
                        this._markKeyFailed(currentKey.id);
                        lastError = new Error(errorMsg);
                        continue;
                    }
                    
                    throw new Error(errorMsg);
                }

                const data = await response.json();
                let content;

                // 解析不同API的响应格式
                switch (this.currentProvider) {
                    case 'gemini':
                        content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        break;
                    case 'claude':
                        content = data.content?.[0]?.text;
                        break;
                    default:
                        content = data.choices?.[0]?.message?.content;
                        break;
                }

                if (!content) {
                    throw new Error('API返回内容为空');
                }

                return this._parseResponse(content);

            } catch (error) {
                lastError = error;
                // 网络错误时尝试下一个key
                if (error.message.includes('network') || error.message.includes('fetch')) {
                    this._markKeyFailed(currentKey.id);
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error('所有API Key均请求失败');
    }

    _buildFullPrompt(prompt, character, currentLocation = null, currentNPC = null, timeInfo = null) {
        // User Prompt — 基础层
        let fullPrompt = `${prompt}  // 玩家原始输入\n\n`;

        // 添加时间信息（有时间系统后注入）
        if (timeInfo) {
            fullPrompt += `【当前时间】\n`;
            fullPrompt += `时辰：${timeInfo.hour}（${timeInfo.hourName}时）\n`;
            fullPrompt += `天气：${timeInfo.weather}\n`;
            fullPrompt += `季节：${timeInfo.season}\n`;
            fullPrompt += `第${timeInfo.day}天\n`;
            fullPrompt += `\n`;
        }

        // 添加角色信息
        if (character) {
            fullPrompt += `【当前角色】\n`;
            fullPrompt += `姓名：${character.name}\n`;
            fullPrompt += `身份：${character.identity || '未设定'}\n`;
            fullPrompt += `灵根：${character.spiritual_root_type}（${character.spiritual_root_elements}）\n`;
            fullPrompt += `战力：${character.combat_power || 100}\n`;
            fullPrompt += `生命：${character.hp}/${character.max_hp}　法力：${character.mp}/${character.max_mp}\n`;
            if (character.sect) {
                fullPrompt += `门派：${character.sect}\n`;
            }
            fullPrompt += `\n`;
        }
        
        // 【行动意图解析】新增：防止玩家短输入导致AI缺乏上下文
        fullPrompt += `【行动意图解析】\n`;
        fullPrompt += `玩家发送：「${prompt}」\n`;
        // inferredIntent 和 currentNPCRelation 后续实现
        fullPrompt += `推断意图：${this._inferIntent(prompt)}\n`;
        if (currentNPC) {
            const relation = character?.npc_relations?.[currentNPC.name] || 0;
            let relationLevel = '陌生';
            if (relation >= 60) relationLevel = '亲近';
            else if (relation >= 10) relationLevel = '一般';
            fullPrompt += `当前关系：与${currentNPC.name}当前关系：${relationLevel}（好感度${relation}）\n`;
        }
        fullPrompt += `\n`;
        
        // 添加场景层信息（时间系统完成后注入）
        if (timeInfo && currentLocation) {
            fullPrompt += `【当前场景】\n`;
            fullPrompt += `位置：${currentLocation.name}\n`;

            // 时辰描述
            const hourDescriptions = {
                0: '子时：深夜，万籁俱寂',
                1: '丑时：夜色深沉，万物沉睡',
                2: '寅时：黎明将至，天色微明',
                3: '卯时：晨光初现，旭日东升',
                4: '辰时：清晨，万物苏醒',
                5: '巳时：上午，阳光渐盛',
                6: '午时：日光正盛，阳气最旺',
                7: '未时：午后，日过中天',
                8: '申时：下午，阳光西斜',
                9: '酉时：日暮西沉，夕阳西下',
                10: '戌时：黄昏，夜幕降临',
                11: '亥时：夜晚，繁星点点'
            };
            const hourDesc = hourDescriptions[timeInfo.hour] || '';
            fullPrompt += `时辰：${timeInfo.hourName}时（${hourDesc}）\n`;
            fullPrompt += `天气：${timeInfo.weather}　季节：${timeInfo.season}\n`;

            if (currentLocation.atmosphere) {
                fullPrompt += `地点氛围：${currentLocation.atmosphere}\n`;
            }
            if (currentLocation.description) {
                fullPrompt += `地点特征：${currentLocation.description}\n`;
            }
            if (currentLocation.access_rule) {
                fullPrompt += `进入限制：${currentLocation.access_rule}\n`;
            }

            // 在场人物（当前时辰）- 后续实现NPC日程表后注入
            // fullPrompt += `在场人物（当前时辰）：${presentNPCs}\n`;

            fullPrompt += `\n`;
        }
        // 如果没有时间信息，使用旧版位置信息
        else if (currentLocation) {
            fullPrompt += `【当前位置】\n`;
            fullPrompt += `地点：${currentLocation.name}\n`;
            if (currentLocation.description) {
                fullPrompt += `描述：${currentLocation.description}\n`;
            }
            if (currentLocation.atmosphere) {
                fullPrompt += `氛围：${currentLocation.atmosphere}\n`;
            }
            fullPrompt += `\n`;
        }

        // 添加当前NPC信息
        if (currentNPC) {
            fullPrompt += `【互动对象】\n`;
            fullPrompt += `名：${currentNPC.name}（关系亲近时称呼）\n`;
            fullPrompt += `字：${currentNPC.zi}（关系疏远时称呼）\n`;
            fullPrompt += `称号：${currentNPC.title}\n`;
            fullPrompt += `身份：${currentNPC.sect} ${currentNPC.title}\n`;
            fullPrompt += `性格：${currentNPC.personality}\n`;
            fullPrompt += `专长：${currentNPC.speciality}\n`;
            if (currentNPC.relationship) {
                fullPrompt += `人物关系：${currentNPC.relationship}\n`;
            }
            fullPrompt += `\n`;
        }
        
        fullPrompt += `【重要提醒】\n`;
        fullPrompt += `- 结合玩家行动和角色当前状态生成剧情\n`;
        fullPrompt += `- 不可重复之前的剧情内容\n`;
        fullPrompt += `- 保持剧情连贯性和逻辑性\n`;
        
        // 添加强制性要求
        fullPrompt += `\n【强制性要求】\n`;
        fullPrompt += `1. 字数要求：剧情描述必须至少800字，严重不足时补充环境、心理、细节描写\n`;
        fullPrompt += `2. 地点要求：必须严格根据【当前位置】生成剧情，不可擅自更改地点\n`;
        fullPrompt += `3. 格式要求：剧情描述后必须附加结算块，格式严格遵循System Prompt规定\n`;
        fullPrompt += `4. 语言要求：必须使用简体中文，禁用繁体字\n`;
        fullPrompt += `5. 内容要求：必须直接回应玩家行动「${prompt}」，不可生成无关内容\n`;
        fullPrompt += `6. 分段要求（强制执行）：\n`;
        fullPrompt += `   - 每段200-300字，段与段之间必须有空行分隔\n`;
        fullPrompt += `   - 环境描写、对话、动作、心理必须分不同段落\n`;
        fullPrompt += `   - 对话必须独占一行，格式为『对话内容』\n`;
        fullPrompt += `   - 场景切换时必须分段\n`;
        fullPrompt += `   - 严禁所有内容堆成一大段\n`;

        // 添加身份视角要求
        const identity = character?.identity || '修仙者';
        fullPrompt += `\n【身份视角要求】\n`;
        fullPrompt += `当前身份：${identity}\n`;
        
        switch (identity) {
            case '修仙者':
                fullPrompt += `·可进入仙门各门派，可接触仙门NPC\n`;
                fullPrompt += `·AI以第三人称全知视角叙述，带入修仙视角\n`;
                fullPrompt += `·可见修仙界的灵气流动、法术波动等细节\n`;
                break;
            case '平民':
                fullPrompt += `·无法直接进入门派内部，可见NPC限于人间普通人和商贩\n`;
                fullPrompt += `·AI描写侧重人间烟火气，用受限视角叙述\n`;
                fullPrompt += `·遭遇修仙事件时，叙述带"不明所以"的困惑感\n`;
                break;
            case '天神':
                fullPrompt += `·带有神明俯视视角，可感知天道规则\n`;
                fullPrompt += `·受天规约束，不可直接插手世间\n`;
                fullPrompt += `·描写带有超然、悲悯的神明视角\n`;
                break;
            case '鬼魂':
                fullPrompt += `·只有通灵识者可见，可进入幽都鬼市\n`;
                fullPrompt += `·不可被普通人看见，描写带阴冷飘渺感\n`;
                fullPrompt += `·可感知阴阳两界的界限\n`;
                break;
            case '妖族':
                fullPrompt += `·可进入妖域，在人间需以人形示人\n`;
                fullPrompt += `·身份暴露有风险，描写带野性直觉感\n`;
                fullPrompt += `·可感知妖气和其他妖族的存在\n`;
                break;
            default:
                fullPrompt += `·默认修仙者视角\n`;
        }

        // 开场特殊处理：玩家输入"开始"时，添加前置说明杜绝AI介绍世界观
        if (prompt === '开始' || prompt === 'start') {
            fullPrompt += `\n【开场指令】\n`;
            fullPrompt += `玩家开始游戏。角色${character?.name || '未知'}（${identity}）当前身处${currentLocation?.name || '未知地点'}。\n`;
            fullPrompt += `请直接从当前场景开场，用环境细节和角色感知带入世界，\n`;
            fullPrompt += `不介绍世界观，不交代背景，像小说第一章那样开始。\n`;
        }

        return fullPrompt;
    }

    // 推断玩家意图（简单规则）
    _inferIntent(prompt) {
        const action = prompt.toLowerCase();
        if (action.includes('找') || action.includes('去') || action.includes('拜访')) {
            return '主动寻访，目的未明';
        }
        if (action.includes('探索') || action.includes('查看') || action.includes('观察')) {
            return '探索周围环境';
        }
        if (action.includes('战斗') || action.includes('攻击') || action.includes('打')) {
            return '发起战斗';
        }
        if (action.includes('对话') || action.includes('说') || action.includes('问')) {
            return '与NPC交流';
        }
        if (action.includes('使用') || action.includes('用') || action.includes('吃')) {
            return '使用物品';
        }
        return '进行一般行动';
    }

    _parseResponse(content) {
        // 首先移除结算块，避免干扰解析
        let cleanContent = content;
        const settlementMatch = content.match(/【结算开始】[\s\S]*?【结算结束】/);
        if (settlementMatch) {
            cleanContent = content.replace(settlementMatch[0], '').trim();
        }

        const lines = cleanContent.split('\n');
        let plot = '';
        const options = [];
        let inOptions = false;
        let inPlot = true;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                // 空行可能是段落分隔或选项区域开始
                if (inPlot && plot.length > 100) {
                    // 如果已经有足够剧情内容，遇到空行可能意味着选项开始
                    continue;
                }
                continue;
            }

            // 检测选项区域开始
            if (trimmedLine.match(/^(选项|选择|行动|你可以|请选择一个)/i)) {
                inOptions = true;
                inPlot = false;
                continue;
            }

            // 检测选项格式：数字/中文数字 + 分隔符 + 内容
            const optionMatch = trimmedLine.match(/^(?:[\d一二三四五六七八九十]+[.、)\s]+|\*\*|--)(.+)$/);
            if (optionMatch && (inOptions || trimmedLine.length < 50)) {
                options.push(optionMatch[1].replace(/^\*\*|\*\*$/g, '').trim());
                inOptions = true;
                inPlot = false;
                continue;
            }

            // 如果已经在选项区域，继续收集选项
            if (inOptions) {
                // 跳过选项列表标题
                if (trimmedLine.match(/^选项列表[：:]/i)) {
                    continue;
                }
                // 检测选项 continuation（缩进的行）
                if (trimmedLine.match(/^[\s]+/) && options.length > 0) {
                    options[options.length - 1] += trimmedLine;
                } else if (trimmedLine.length < 50 && 
                           !trimmedLine.match(/^[【\[]/) && 
                           !trimmedLine.match(/^(选项|选择|行动)/i) &&
                           trimmedLine.length > 0) {
                    // 可能是另一个选项
                    options.push(trimmedLine.replace(/^\*\*|\*\*$/g, '').trim());
                }
                continue;
            }

            // 剧情内容
            if (inPlot) {
                plot += line + '\n';
            }
        }

        // 如果没有解析到选项，尝试从原始内容中提取
        if (options.length === 0) {
            const allLines = content.split('\n');
            for (const line of allLines) {
                const trimmed = line.trim();
                // 跳过标题类内容
                if (trimmed.match(/^选项列表[：:]/i) || trimmed === '-') {
                    continue;
                }
                // 匹配 **选项X：** 或 选项X： 格式
                const match = trimmed.match(/(?:\*\*|\s)*(?:选项)?[\s]*[一二三四1234][.、:\s]+(.+?)(?:\*\*|\s)*$/);
                if (match && match[1].length > 5) {
                    options.push(match[1].trim());
                }
            }
        }

        // 清理 plot 中的选项残留
        let cleanPlot = plot.trim();
        // 移除可能混入的选项标记
        cleanPlot = cleanPlot.replace(/\*\*选项[一二三四1234][：:]\*\*/g, '');
        cleanPlot = cleanPlot.replace(/选项[一二三四1234][：:]/g, '');

        // 确保有默认选项
        if (options.length === 0) {
            options.push('继续前进', '观察周围环境', '休息恢复');
        }

        return { plot: cleanPlot, options: options.slice(0, 4), rawContent: content };
    }
}

// 解析结算块（工具函数，供GameStateService使用）
function parseSettlement(content) {
        const result = {
            event: null,
            encounter: null,
            itemsGained: [],
            itemsLost: [],
            relations: [],
            location: null,
            timePassed: 0,
            goldGained: 0,
            goldLost: 0,
            questStart: null,
            questDone: null,
            skillChanges: [],
            flags: []
        };

        try {
            // 查找结算块
            const settlementMatch = content.match(/【结算开始】([\s\S]*?)【结算结束】/);
            if (!settlementMatch) {
                console.log('未找到结算块');
                return result;
            }

            const settlementBlock = settlementMatch[1].trim();
            const lines = settlementBlock.split('\n').map(line => line.trim()).filter(line => line);

            for (const line of lines) {
                // EVENT:事件名称
                const eventMatch = line.match(/^EVENT:(.+)$/);
                if (eventMatch) {
                    result.event = eventMatch[1].trim();
                    continue;
                }

                // ENCOUNTER:NPC姓名
                const encounterMatch = line.match(/^ENCOUNTER:(.+)$/);
                if (encounterMatch) {
                    result.encounter = encounterMatch[1].trim();
                    continue;
                }

                // ITEM+:物品名×数量
                const itemPlusMatch = line.match(/^ITEM+:(.+?)×(\d+)$/);
                if (itemPlusMatch) {
                    result.itemsGained.push({
                        name: itemPlusMatch[1].trim(),
                        count: parseInt(itemPlusMatch[2])
                    });
                    continue;
                }

                // ITEM-:物品名×数量
                const itemMinusMatch = line.match(/^ITEM-:(.+?)×(\d+)$/);
                if (itemMinusMatch) {
                    result.itemsLost.push({
                        name: itemMinusMatch[1].trim(),
                        count: parseInt(itemMinusMatch[2])
                    });
                    continue;
                }

                // RELATION:NPC姓名+/-数值
                const relationMatch = line.match(/^RELATION:(.+?)([+-])(\d+)$/);
                if (relationMatch) {
                    result.relations.push({
                        npc: relationMatch[1].trim(),
                        change: parseInt(relationMatch[2] + relationMatch[3])
                    });
                    continue;
                }

                // LOCATION:当前地点完整路径
                const locationMatch = line.match(/^LOCATION:(.+)$/);
                if (locationMatch) {
                    result.location = locationMatch[1].trim();
                    continue;
                }

                // TIME+:消耗时辰数
                const timeMatch = line.match(/^TIME+:(\d+)$/);
                if (timeMatch) {
                    result.timePassed = parseInt(timeMatch[1]);
                    continue;
                }

                // GOLD+:获得灏坤石数量
                const goldPlusMatch = line.match(/^GOLD+:(\d+)$/);
                if (goldPlusMatch) {
                    result.goldGained = parseInt(goldPlusMatch[1]);
                    continue;
                }

                // GOLD-:消耗灏坤石数量
                const goldMinusMatch = line.match(/^GOLD-:(\d+)$/);
                if (goldMinusMatch) {
                    result.goldLost = parseInt(goldMinusMatch[1]);
                    continue;
                }

                // QUEST_START:任务名
                const questStartMatch = line.match(/^QUEST_START:(.+)$/);
                if (questStartMatch) {
                    result.questStart = questStartMatch[1].trim();
                    continue;
                }

                // QUEST_DONE:任务名
                const questDoneMatch = line.match(/^QUEST_DONE:(.+)$/);
                if (questDoneMatch) {
                    result.questDone = questDoneMatch[1].trim();
                    continue;
                }

                // SKILL+:技能名·熟练度变化
                const skillMatch = line.match(/^SKILL+:(.+?)·(\d+)$/);
                if (skillMatch) {
                    result.skillChanges.push({
                        skill: skillMatch[1].trim(),
                        change: parseInt(skillMatch[2])
                    });
                    continue;
                }

                // FLAG:标记名
                const flagMatch = line.match(/^FLAG:(.+)$/);
                if (flagMatch) {
                    result.flags.push(flagMatch[1].trim());
                    continue;
                }
            }

            console.log('解析结算块成功:', result);
            return result;

        } catch (error) {
            console.error('解析结算块失败:', error);
            return result;
        }
    }

// ==================== GameStateService ====================
class GameStateService {
    constructor() {
        this.storageService = null;
        this.aiService = null;
        this.currentCharacter = null;
        this.currentLocation = null;
        this.gameProgress = null;
        this.conversationHistory = [];
        this.MAX_HISTORY_LENGTH = 6;
    }

    async init(storageService, aiService) {
        this.storageService = storageService;
        this.aiService = aiService;
        await this.loadGameData();
    }

    async loadGameData() {
        try {
            const characters = await this.storageService.getAllCharacters();
            if (characters.length > 0) {
                this.currentCharacter = characters[0];
                this.gameProgress = await this.storageService.getGameProgress(this.currentCharacter.id);
                if (!this.gameProgress) {
                    // 根据角色选择的国家设置初始位置
                    const countryMap = {
                        '玄北': '人间·玄北国',
                        '西刹': '人间·西刹国',
                        '东澜': '人间·东澜国'
                    };
                    const initialLocation = countryMap[this.currentCharacter.country] || '人间·玄北国';

                    this.gameProgress = {
                        character_id: this.currentCharacter.id,
                        current_location: initialLocation,
                        game_days: 1,
                        current_hour: 6,  // 默认从卯时（6点）开始
                        total_days: 1,
                        season: '春',  // 默认春季
                        weather: '晴',  // 默认晴天
                        completed_quests: [],
                        active_quests: [],
                        last_save: new Date().toISOString()
                    };
                    await this.storageService.saveGameProgress(this.currentCharacter.id, this.gameProgress);
                }
                this.currentLocation = this.gameProgress.current_location;
            }
        } catch (error) {
            console.error('游戏数据加载失败:', error);
        }
    }

    getCurrentCharacter() { return this.currentCharacter; }

    async createCharacter(characterData) {
        const characters = await this.storageService.getAllCharacters();
        const newId = characters.length > 0 ? Math.max(...characters.map(c => c.id)) + 1 : 1;

        const character = {
            id: newId,
            user_id: 1,
            created_at: new Date().toISOString(),
            ...characterData,
            root_bone: characterData.root_bone || 50,
            comprehension: characterData.comprehension || 50,
            hp: 100,
            mp: 80
        };

        await this.storageService.saveCharacter(character);

        // 根据角色选择的国家设置初始位置
        const countryMap = {
            '玄北': '人间·玄北国',
            '西刹': '人间·西刹国',
            '东澜': '人间·东澜国'
        };
        console.log('角色国家:', character.country);
        const initialLocation = countryMap[character.country] || '人间·玄北国';
        console.log('初始位置:', initialLocation);

        const gameProgress = {
            character_id: character.id,
            current_location: initialLocation,
            game_days: 1,
            current_hour: 6,  // 默认从卯时（6点）开始
            total_days: 1,
            season: '春',  // 默认春季
            weather: '晴',  // 默认晴天
            completed_quests: [],
            active_quests: [],
            last_save: new Date().toISOString()
        };
        await this.storageService.saveGameProgress(character.id, gameProgress);

        this.currentCharacter = character;
        this.gameProgress = gameProgress;
        this.currentLocation = gameProgress.current_location;

        return character;
    }

    // 时辰名称映射（0-11对应子丑寅卯辰巳午未申酉戌亥）
    static HOUR_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

    // 季节映射（根据天数计算）
    static SEASONS = ['春', '夏', '秋', '冬'];

    // 天气类型
    static WEATHER_TYPES = {
        '春': ['晴', '多云', '小雨', '微风'],
        '夏': ['晴', '多云', '雷阵雨', '炎热'],
        '秋': ['晴', '多云', '凉爽', '大风'],
        '冬': ['晴', '多云', '小雪', '寒冷']
    };

    /**
     * 推进时间
     * @param {number} hours - 推进的时辰数
     * @returns {object} - 时间变化信息
     */
    async advanceTime(hours) {
        if (!this.gameProgress) return null;

        const oldHour = this.gameProgress.current_hour;
        const oldDay = this.gameProgress.total_days;

        // 计算新的时辰和天数
        let newHour = oldHour + hours;
        let daysPassed = 0;

        while (newHour >= 12) {
            newHour -= 12;
            daysPassed++;
        }

        // 更新游戏进度
        this.gameProgress.current_hour = newHour;
        this.gameProgress.total_days += daysPassed;
        this.gameProgress.game_days = this.gameProgress.total_days;

        // 更新季节（每90天一个季节）
        const seasonIndex = Math.floor((this.gameProgress.total_days - 1) / 90) % 4;
        this.gameProgress.season = GameStateService.SEASONS[seasonIndex];

        // 随机更新天气（跨日或时辰变化较大时）
        if (daysPassed > 0 || hours >= 3) {
            const weatherTypes = GameStateService.WEATHER_TYPES[this.gameProgress.season];
            this.gameProgress.weather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
        }

        // 保存进度
        await this.storageService.saveGameProgress(this.currentCharacter.id, this.gameProgress);

        // 跨日检测：触发日报和商贩刷新
        if (daysPassed > 0) {
            await this._onDayChanged(daysPassed);
        }

        return {
            oldHour,
            newHour,
            oldDay,
            newDay: this.gameProgress.total_days,
            daysPassed,
            hourName: GameStateService.HOUR_NAMES[newHour],
            season: this.gameProgress.season,
            weather: this.gameProgress.weather
        };
    }

    /**
     * 跨日触发事件
     */
    async _onDayChanged(daysPassed) {
        console.log(`跨日触发：${daysPassed}天`);
        // TODO: 触发日报生成和商贩刷新
        // 这里可以调用日报系统和商贩刷新系统
    }

    /**
     * 获取当前时间信息
     */
    getCurrentTime() {
        if (!this.gameProgress) return null;
        return {
            hour: this.gameProgress.current_hour,
            hourName: GameStateService.HOUR_NAMES[this.gameProgress.current_hour],
            day: this.gameProgress.total_days,
            season: this.gameProgress.season,
            weather: this.gameProgress.weather
        };
    }

    async processAction(action, currentNPC = null) {
        if (!this.currentCharacter) {
            throw new Error('当前没有选择角色');
        }
        if (!this.aiService.hasApiKey()) {
            throw new Error('请先配置DeepSeek API密钥');
        }

        // 获取当前位置的完整信息（四层查找：realm→region→location→building）
        let locationObj = null;
        if (this.currentLocation) {
            const staticData = window.gameApp?.getStaticData ? window.gameApp.getStaticData() : {};
            const locationName = this.currentLocation;
            
            // 第1层：查找 realm（界域）
            if (staticData.realms) {
                locationObj = staticData.realms.find(r => r.name === locationName || r.slug === locationName);
            }
            
            // 第2层：查找 region（地区/国家）
            if (!locationObj && staticData.realms) {
                for (const realm of staticData.realms) {
                    if (realm.regions) {
                        const region = realm.regions.find(r => r.name === locationName || r.slug === locationName);
                        if (region) {
                            locationObj = {...region, realm: realm.name, type: 'region'};
                            break;
                        }
                    }
                }
            }
            
            // 第3层：查找 location（具体地点）
            if (!locationObj && staticData.locations) {
                locationObj = staticData.locations.find(l => l.name === locationName || l.slug === locationName);
            }
            
            // 第4层：查找 building（建筑）
            if (!locationObj && staticData.sects) {
                for (const sect of staticData.sects) {
                    if (sect.buildings) {
                        const building = sect.buildings.find(b => b.name === locationName || b.slug === locationName);
                        if (building) {
                            locationObj = {...building, sect: sect.name, type: 'building'};
                            break;
                        }
                    }
                }
            }
        }

        this.addToConversationHistory('user', action);

        // 获取当前时间信息
        const timeInfo = this.getCurrentTime();

        const response = await this.aiService.generateResponse(
            action,
            this.getConversationHistoryForAI(),
            this.currentCharacter,
            locationObj,
            currentNPC,
            timeInfo
        );
        this.addToConversationHistory('assistant', response.plot);

        // 解析结算块
        const settlementResult = parseSettlement(response.rawContent);

        // 处理时间推进（TIME+字段）
        if (settlementResult.timePassed > 0) {
            const timeChange = await this.advanceTime(settlementResult.timePassed);
            if (timeChange) {
                settlementResult.timeChange = timeChange;
                console.log(`时间推进：${timeChange.hourName}时 → ${GameStateService.HOUR_NAMES[timeChange.newHour]}时`);
            }
        }

        // 更新游戏状态
        await this.updateGameState();

        // 将结算结果附加到响应中
        response.settlement = settlementResult;

        return response;
    }

    addToConversationHistory(role, content) {
        this.conversationHistory.push({ role, content, timestamp: new Date().toISOString() });
        if (this.conversationHistory.length > this.MAX_HISTORY_LENGTH) {
            this.conversationHistory.shift();
        }
    }

    getConversationHistoryForAI() {
        return this.conversationHistory.map(msg => ({
            role: msg.role === 'ai' ? 'assistant' : msg.role,
            content: msg.content
        }));
    }

    async updateGameState() {
        if (this.gameProgress) {
            this.gameProgress.game_days += 1;
            this.gameProgress.last_save = new Date().toISOString();
            await this.storageService.saveGameProgress(this.currentCharacter.id, this.gameProgress);
        }
    }

    async loadGame(characterId) {
        const character = await this.storageService.getCharacter(characterId);
        if (!character) throw new Error('角色不存在');

        const progress = await this.storageService.getGameProgress(characterId);
        this.currentCharacter = character;
        this.gameProgress = progress;
        this.currentLocation = progress ? progress.current_location : '人间·玄北国';
        this.conversationHistory = [];

        return character;
    }

    async resetGame() {
        this.conversationHistory = [];
        if (this.currentCharacter) {
            this.gameProgress = {
                character_id: this.currentCharacter.id,
                current_location: '人间·玄北国',
                game_days: 1,
                completed_quests: [],
                active_quests: [],
                last_save: new Date().toISOString()
            };
            await this.storageService.saveGameProgress(this.currentCharacter.id, this.gameProgress);
            this.currentLocation = this.gameProgress.current_location;
        }
    }

    // 应用结算数据
    async applySettlement(settlement) {
        if (!this.currentCharacter || !this.gameProgress) {
            console.warn('无法应用结算：当前没有角色或游戏进度');
            return { success: false, error: '没有角色或游戏进度' };
        }

        const result = {
            success: true,
            changes: []
        };

        try {
            // 1. 处理物品获得
            if (settlement.itemsGained && settlement.itemsGained.length > 0) {
                for (const item of settlement.itemsGained) {
                    await this.addItem(item.name, item.count);
                    result.changes.push({ type: 'item', name: item.name, count: item.count, action: 'gain' });
                }
            }

            // 2. 处理物品消耗
            if (settlement.itemsLost && settlement.itemsLost.length > 0) {
                for (const item of settlement.itemsLost) {
                    await this.removeItem(item.name, item.count);
                    result.changes.push({ type: 'item', name: item.name, count: item.count, action: 'lose' });
                }
            }

            // 3. 处理好感度变化
            if (settlement.relations && settlement.relations.length > 0) {
                for (const relation of settlement.relations) {
                    await this.updateNPCRelation(relation.npc, relation.change);
                    result.changes.push({ type: 'relation', npc: relation.npc, change: relation.change });
                }
            }

            // 4. 处理地点变化
            if (settlement.location) {
                this.currentLocation = settlement.location;
                this.gameProgress.current_location = settlement.location;
                result.changes.push({ type: 'location', location: settlement.location });
            }

            // 5. 处理时间流逝
            if (settlement.timePassed > 0) {
                this.gameProgress.game_days += settlement.timePassed;
                result.changes.push({ type: 'time', days: settlement.timePassed });
            }

            // 6. 处理灏坤石变化
            if (settlement.goldGained > 0) {
                this.currentCharacter.gold = (this.currentCharacter.gold || 0) + settlement.goldGained;
                result.changes.push({ type: 'gold', amount: settlement.goldGained, action: 'gain' });
            }
            if (settlement.goldLost > 0) {
                this.currentCharacter.gold = (this.currentCharacter.gold || 0) - settlement.goldLost;
                result.changes.push({ type: 'gold', amount: settlement.goldLost, action: 'lose' });
            }

            // 7. 处理任务
            if (settlement.questStart) {
                this.gameProgress.active_quests = this.gameProgress.active_quests || [];
                this.gameProgress.active_quests.push({
                    name: settlement.questStart,
                    status: 'active',
                    start_time: new Date().toISOString()
                });
                result.changes.push({ type: 'quest', name: settlement.questStart, action: 'start' });
            }
            if (settlement.questDone) {
                this.gameProgress.active_quests = this.gameProgress.active_quests || [];
                const questIndex = this.gameProgress.active_quests.findIndex(q => q.name === settlement.questDone);
                if (questIndex !== -1) {
                    this.gameProgress.active_quests.splice(questIndex, 1);
                }
                this.gameProgress.completed_quests = this.gameProgress.completed_quests || [];
                this.gameProgress.completed_quests.push({
                    name: settlement.questDone,
                    complete_time: new Date().toISOString()
                });
                result.changes.push({ type: 'quest', name: settlement.questDone, action: 'complete' });
            }

            // 8. 处理技能变化
            if (settlement.skillChanges && settlement.skillChanges.length > 0) {
                for (const skill of settlement.skillChanges) {
                    await this.updateSkill(skill.skill, skill.change);
                    result.changes.push({ type: 'skill', name: skill.skill, change: skill.change });
                }
            }

            // 9. 处理事件标记
            if (settlement.flags && settlement.flags.length > 0) {
                this.gameProgress.flags = this.gameProgress.flags || [];
                for (const flag of settlement.flags) {
                    if (!this.gameProgress.flags.includes(flag)) {
                        this.gameProgress.flags.push(flag);
                        result.changes.push({ type: 'flag', name: flag });
                    }
                }
            }

            // 10. 处理首次互动记录
            if (settlement.encounter) {
                this.gameProgress.encountered_npcs = this.gameProgress.encountered_npcs || [];
                if (!this.gameProgress.encountered_npcs.includes(settlement.encounter)) {
                    this.gameProgress.encountered_npcs.push(settlement.encounter);
                    result.changes.push({ type: 'encounter', npc: settlement.encounter });
                }
            }

            // 保存更新后的角色和进度
            await this.storageService.saveCharacter(this.currentCharacter);
            await this.storageService.saveGameProgress(this.currentCharacter.id, this.gameProgress);

            console.log('结算应用成功:', result);
            return result;

        } catch (error) {
            console.error('应用结算失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 添加物品到背包
    async addItem(itemName, count) {
        this.currentCharacter.inventory = this.currentCharacter.inventory || [];
        const existingItem = this.currentCharacter.inventory.find(i => i.name === itemName);
        if (existingItem) {
            existingItem.count += count;
        } else {
            this.currentCharacter.inventory.push({ name: itemName, count: count });
        }
    }

    // 从背包移除物品
    async removeItem(itemName, count) {
        this.currentCharacter.inventory = this.currentCharacter.inventory || [];
        const existingItem = this.currentCharacter.inventory.find(i => i.name === itemName);
        if (existingItem) {
            existingItem.count -= count;
            if (existingItem.count <= 0) {
                const index = this.currentCharacter.inventory.indexOf(existingItem);
                this.currentCharacter.inventory.splice(index, 1);
            }
        }
    }

    // 更新NPC关系
    async updateNPCRelation(npcName, change) {
        this.currentCharacter.npc_relations = this.currentCharacter.npc_relations || {};
        this.currentCharacter.npc_relations[npcName] = (this.currentCharacter.npc_relations[npcName] || 0) + change;
    }

    // 更新技能熟练度
    async updateSkill(skillName, change) {
        this.currentCharacter.skills = this.currentCharacter.skills || {};
        this.currentCharacter.skills[skillName] = (this.currentCharacter.skills[skillName] || 0) + change;
    }
}

// ==================== 完整静态数据（严格按原始数据） ====================
const staticData = {
    // 六界世界观
    world: {
        name: '六界',
        description: '天道为轴，六界并立'
    },

    // 玄北国风物志
    local_features: {
        canghu_jie: '苍斛街南北全长约三里，沿街有流动摊贩二三十处，主要售卖烤肉串、热茶、糖葫芦式的冰糖果串等小食。每逢年节，苍斛街会悬挂冰灯数百盏，是凛京最壮观的景象之一。',
        xianze_cheng: {
            商业特色: '寒晶石、冰铁矿石、兽骨器具，与御桓派有半官方的固定采购协议',
            居民区: '分上下两层，矿工居住于下层（靠近矿道），匠人居于上层，设有小型祠堂',
            特殊之处: '城区地下有废弃旧矿道，传说曾有人在其中发现过上古器物残片'
        },
        lingdu_cheng: {
            商业特色: '外来货物在此报关、中转，本地出产的雪鹿肉、冰羊毛是主要输出品',
            特殊设施: '冰原瞭望台（城区最高点，可观测天气与来访商队方向）',
            居民构成: '本地牧民、商号伙计、官吏、驻守士兵，外来人口流动较大'
        },
        yunji_cheng: {
            商业特色: '文房四宝、刻本书籍、医药，以及高档食肆（文人聚集带动消费）',
            特殊传统: '每年仲冬举行「冰灯节」，全城悬灯，是玄北国最大的年节庆典，昀霁城为主会场',
            居民构成: '文人士子、官吏家眷、医者、小商贩，整体文化氛围较浓'
        },
        shuoling_cheng: {
            特殊地貌: '城区北侧有「千丈冰壁」，是玄北国地标之一，传说冰壁内封存有上古异兽',
            居民构成: '军士家眷、后勤工人、少量商贩，人口不多，流动性高',
            与外界联系: '设有专属栈道连接凛京，另有冰原驿路向北延伸，用于侦查'
        },
        renjianshi_cun: {
            禁忌: '外人严禁进入村庄，违者由村人自行处置，巡检司不予干涉（历史沿革）',
            经济: '由专门的顾氏粮行负责对外贸易，外人只能在村口与指定顾氏代表交易',
            特产: '人世间粳米、时蔬、瓜果（玄北国其他地区完全无法种植），价格三至五倍于普通粮',
            货币: '与外界相同，但外人进村时若发现则一律驱逐，不问缘由'
        }
    },
    
    // 六界详细数据
    realms: [
        {
            id: 1,
            slug: 'heaven',
            name: '天界',
            realm_type: 'heaven',
            description: '生而为神，执掌世间，居九重天之上。后世神力源自"天道"，亦受之管束。然则近来，"天道"却有式微之象。',
            has_regions: false,
            locations: []
        },
        {
            id: 2,
            slug: 'mortal',
            name: '人间',
            realm_type: 'mortal',
            description: '位雪山之巅，凛冬不散而为冰雪倾覆，城区间以栈道相通，为玄北。于森林中央立国，木系法术为根基，与外称男女平等，为西刹。建于滨海之地，气候四季分明，为东澜。',
            has_regions: true,
            regions: [
                {
                    id: 1,
                    slug: 'xuanbei',
                    name: '玄北国',
                    region_type: 'country',
                    description: '玄北国位于雪山之巅，四面冰壁，凛冬不散，年均气温极低，积雪常年不化。国土以主城「凛京」为核心，各城区间以地下/半地下封闭栈道贯通，栈道内灯油长明，商队常年穿行。',
                    geography: '雪山之巅，四面冰壁',
                    climate: '凛冬不散，极寒',
                    politics: '男尊女卑，四方神即国君本人',
                    economy: '农产品极贵（人世间产出为主），手工业发达，毛皮、冰晶制品享誉各界',
                    population: '国都凛京最为密集，各城区次之，山道沿途仅有驿站与小型聚落',
                    resources: '寒晶石（炼器材料）、冰魄草（药材）、雪狐毛皮、冰川深水',
                    locations: [
                        {
                            id: 101,
                            slug: 'linjing',
                            name: '凛京',
                            location_type: 'city',
                            description: '国都·凛京建于一处相对平坦的山腰台地之上，四周以十丈高的玄铁城墙围合，城墙上常年结有冰晶，反光如镜。城内建筑多以黑石为基、雪松为梁，屋顶皆有特制的斜坡以防积雪压塌。主干道宽阔，铺有防滑灰石，两侧商铺毗邻，城中终日炉烟袅袅，是整个玄北国最热闹的地方。',
                            features: ['玄铁城墙', '黑石建筑', '雪松梁', '斜坡屋顶', '防滑灰石主干道', '商铺毗邻'],
                            sub_locations: [
                                {
                                    id: 1011,
                                    slug: 'tianji-palace',
                                    name: '皇城（天极宫城）',
                                    location_type: 'palace',
                                    description: '位于凛京正中，以三丈高的玄冰宫墙单独围合，城门常年封闭，仅于朝日与重大节庆开启。宫城内建筑以白石与寒玉为主，终年有冰火灵阵维持温度，是玄北国唯一不显寒意之处。',
                                    features: ['玄冰宫墙', '白石建筑', '寒玉装饰', '冰火灵阵', '常年封闭的城门'],
                                    sub_locations: [
                                        {
                                            id: 10111,
                                            slug: 'tianji-dian',
                                            name: '天极殿',
                                            description: '朝堂所在，国君每逢朝日于此听政，设有帘幕一道（执明神君罚为童身期间所设）'
                                        },
                                        {
                                            id: 10112,
                                            slug: 'bingxuan-gong',
                                            name: '冰璇宫',
                                            description: '国君寝宫，常年有宫女内侍伺候，外人无法踏足'
                                        },
                                        {
                                            id: 10113,
                                            slug: 'xuanming-ge',
                                            name: '玄明阁',
                                            description: '国君处理政务之所，国政决策皆出于此'
                                        },
                                        {
                                            id: 10114,
                                            slug: 'jinwei-ying',
                                            name: '禁卫营',
                                            description: '天极殿两侧，驻扎禁卫军，日夜换防，戒备森严'
                                        },
                                        {
                                            id: 10115,
                                            slug: 'neiku-si',
                                            name: '内库司',
                                            description: '皇室财货、典籍、珍宝的存放之所，由内库总管负责，外人不得擅入'
                                        },
                                        {
                                            id: 10116,
                                            slug: 'yushan-ju',
                                            name: '御膳局',
                                            description: '皇宫内唯一对外采购的部门，由宫廷御厨主持，苍斛街各大商铺均与之有往来'
                                        }
                                    ]
                                },
                                {
                                    id: 1010,
                                    slug: 'neicheng',
                                    name: '内城',
                                    description: '皇城之外的第一圈，住的是贵族、世家、朝臣及富商，街道宽整，宅邸高门深院，是凛京最体面的居住地带。',
                                    sub_locations: [
                                        {
                                            id: 10101,
                                            slug: 'yudao',
                                            name: '御道',
                                            description: '正对天极殿宫门的主轴大道，仪仗出行时封路，平日偶有贵族车轿往来'
                                        },
                                        {
                                            id: 10102,
                                            slug: 'zhuxue-xiang',
                                            name: '朱雪巷',
                                            description: '高门大宅云集之地，世家府邸连排，宅门皆以黑漆镶金，门前石狮常年结冰'
                                        },
                                        {
                                            id: 10103,
                                            slug: 'yuzhang-jie',
                                            name: '玉璋街',
                                            description: '内城主要商业街，售卖高端毛皮、名贵药材、定制器物，非寻常百姓消费之地'
                                        },
                                        {
                                            id: 10104,
                                            slug: 'linfeng-tai',
                                            name: '凛风台',
                                            description: '内城制高点，可俯瞰全城冰原，达官贵人观赏冰瀑的去处，建有观景楼'
                                        },
                                        {
                                            id: 10105,
                                            slug: 'honglu-si',
                                            name: '鸿胪寺',
                                            description: '接待各国使节与访客，玄北国对外礼仪事务皆由此处统筹'
                                        },
                                        {
                                            id: 10106,
                                            slug: 'taiyi-shu',
                                            name: '太医署',
                                            description: '皇室与贵族专属医馆，另承担国君敕令的宫廷采药任务'
                                        },
                                        {
                                            id: 10107,
                                            slug: 'xunjian-si',
                                            name: '巡检司',
                                            description: '内城治安机构，负责巡逻、缉盗、处理民事纠纷，亦统管城门开闭'
                                        },
                                        {
                                            id: 10108,
                                            slug: 'gongzao-ju',
                                            name: '工造局',
                                            description: '负责城内栈道维护、建筑修缮、暴风后的清雪事务，下属冰工数百'
                                        }
                                    ]
                                },
                                {
                                    id: 1012,
                                    slug: 'waicheng',
                                    name: '外城',
                                    description: '内城之外、城墙之内，是凛京人口最密集、最混杂的区域，普通百姓、商贩、匠人、行旅皆聚于此。街道较内城窄而曲折，但烟火气最旺，各类吃食摊贩于清晨便已开张',
                                    sub_locations: [
                                        {
                                            id: 10121,
                                            slug: 'canghu-jie',
                                            name: '苍斛街',
                                            description: '苍斛街是玄北国最繁华的商业街，以农产品贸易起家，如今已成为集饮食、娱乐、情报、各类商品于一体的综合街道。街道两侧以厚木板为骨架搭建连排商铺，屋檐下挂满各式招幌，风雪天时招幌随风猎猎作响。',
                                            sub_locations: [
                                                {
                                                    id: 101211,
                                                    slug: 'jiaduan-bei',
                                                    name: '甲段·北端',
                                                    description: '农产品与食货区',
                                                    sub_locations: [
                                                        {
                                                            id: 1012111,
                                                            slug: 'gushi-lianghang-zong',
                                                            name: '顾氏粮行（总号）',
                                                            description: '人世间农产品独家总经销，人世间顾家直营，价格最高，货品最佳，供货御膳局'
                                                        },
                                                        {
                                                            id: 1012112,
                                                            slug: 'gushi-lianghang-fen',
                                                            name: '顾氏粮行（分号）',
                                                            description: '人世间农产品零售，与总号同源，量少价高，常有排队'
                                                        },
                                                        {
                                                            id: 1012113,
                                                            slug: 'shuangliang-zhai',
                                                            name: '霜粮斋',
                                                            description: '售卖玄北普通粮食、豆类、干果，价格亲民，品质一般，百姓日常采购首选'
                                                        },
                                                        {
                                                            id: 1012114,
                                                            slug: 'donghuo-pu',
                                                            name: '冻货铺',
                                                            description: '售卖各类冰冻肉食、风干食品，如雪熊肉、冰鱼干等特产，部分为猎户直供'
                                                        },
                                                        {
                                                            id: 1012115,
                                                            slug: 'xueyan-fang',
                                                            name: '雪盐坊',
                                                            description: '售卖特制雪岩盐、调料，其中玄北特有的冰盐，淡淡咸甜，极受欢迎'
                                                        },
                                                        {
                                                            id: 1012116,
                                                            slug: 'zuike-shisi',
                                                            name: '醉客食肆',
                                                            description: '售卖平价快食、热汤面，是苍斛街最早开门的铺子，清晨五更便生火'
                                                        }
                                                    ]
                                                },
                                                {
                                                    id: 101212,
                                                    slug: 'yiduan-zhongbei',
                                                    name: '乙段·中北',
                                                    description: '毛皮与织品区',
                                                    sub_locations: [
                                                        {
                                                            id: 1012121,
                                                            slug: 'xuanqiu-fang',
                                                            name: '玄裘坊',
                                                            description: '售卖顶级毛皮制品（成衣、披风），其中雪狐皮、冰貂皮为招牌，价格不菲，有很多来自贵族的常客'
                                                        },
                                                        {
                                                            id: 1012122,
                                                            slug: 'shuangfang-ju',
                                                            name: '霜纺局',
                                                            description: '售卖冰纱布料、棉麻混织，霜绡弄作坊出品的冰纱在此零售，可定制'
                                                        },
                                                        {
                                                            id: 1012123,
                                                            slug: 'lieren-hang',
                                                            name: '猎人行',
                                                            description: '售卖生皮、兽骨、爪牙的收购与零售，也是猎户行会驻点，亦代办猎人委托任务'
                                                        },
                                                        {
                                                            id: 1012124,
                                                            slug: 'zhenxian-ge',
                                                            name: '针线阁',
                                                            description: '售卖缝补改制服饰、代客裁缝，手艺精湛，擅为旅人改制不适合玄北气候的薄衣'
                                                        }
                                                    ]
                                                },
                                                {
                                                    id: 101213,
                                                    slug: 'bingduan-zhong',
                                                    name: '丙段·中段',
                                                    description: '综合商业与娱乐区（核心地带）',
                                                    sub_locations: [
                                                        {
                                                            id: 1012131,
                                                            slug: 'zhuyue-lou',
                                                            name: '逐月楼',
                                                            description: '青楼、情报大商，拥有各界情报，是整条街最神秘的存在'
                                                        },
                                                        {
                                                            id: 1012132,
                                                            slug: 'xianyue-chafang',
                                                            name: '弦月茶坊',
                                                            description: '有各种茶饮、糕点、棋弈，与逐月楼斜对门，客人多为等待约见之人'
                                                        },
                                                        {
                                                            id: 1012133,
                                                            slug: 'bingxi-tai',
                                                            name: '冰戏台',
                                                            description: '有杂耍、说书、小型戏班驻场，每日申时开演，冬节时有专场大戏'
                                                        },
                                                        {
                                                            id: 1012134,
                                                            slug: 'zhicai-fang',
                                                            name: '掷彩坊',
                                                            description: '可以博彩、押注、赌骰，玄北民间盛行，官府默许但有人数限制'
                                                        },
                                                        {
                                                            id: 1012135,
                                                            slug: 'wenmo-pu',
                                                            name: '文墨铺',
                                                            description: '售卖笔墨纸砚、书册刻本，兼营代写书信，是识字者少的外城的一道风景'
                                                        },
                                                        {
                                                            id: 1012136,
                                                            slug: 'bingjing-ge',
                                                            name: '冰晶阁',
                                                            description: '可以买天然冰晶、进行寒玉原石买卖，御桓派有时会差人来此收购炼器原料'
                                                        }
                                                    ]
                                                },
                                                {
                                                    id: 101214,
                                                    slug: 'dingduan-zhongnan',
                                                    name: '丁段·中南',
                                                    description: '药材与器物区',
                                                    sub_locations: [
                                                        {
                                                            id: 1012141,
                                                            slug: 'bingpo-tang',
                                                            name: '冰魄堂',
                                                            description: '玄北特产药材、外来丹药零售，冰魄草为招牌，亦代购其他国药材'
                                                        },
                                                        {
                                                            id: 1012142,
                                                            slug: 'hanquan-yiguan',
                                                            name: '寒泉医馆',
                                                            description: '有坐堂大夫，可以问诊抓药，外城百姓主要就医处，收费低廉，常年排队'
                                                        },
                                                        {
                                                            id: 1012143,
                                                            slug: 'tiegu-pu',
                                                            name: '铁骨铺',
                                                            description: '售卖铁制工具、家用器具，炉石巷匠人的对外销售点，亦接修缮订单'
                                                        },
                                                        {
                                                            id: 1012144,
                                                            slug: 'xuanshi-fang',
                                                            name: '玄石坊',
                                                            description: '售卖建材、石料、雪松木材，工造局指定采购商，民间建房多来此'
                                                        },
                                                        {
                                                            id: 1012145,
                                                            slug: 'shuanglu-xiangdian',
                                                            name: '霜露香店',
                                                            description: '售卖香料、薰香、蜡烛，兼营驱虫防寒的特制香品，逐月楼的香料供货商'
                                                        }
                                                    ]
                                                },
                                                {
                                                    id: 101215,
                                                    slug: 'wuduan-nan',
                                                    name: '戊段·南端',
                                                    description: '旅人服务区（近栈道枢纽站）',
                                                    sub_locations: [
                                                        {
                                                            id: 1012151,
                                                            slug: 'tongtu-biaoju',
                                                            name: '通途镖局',
                                                            description: '有货物押运、护卫护送的业务，玄北国规模最大的镖局，专营栈道内运输'
                                                        },
                                                        {
                                                            id: 1012152,
                                                            slug: 'ditu-pu',
                                                            name: '地图铺',
                                                            description: '出售玄北国各区栈道路线图，附赠天气预报小册（由当地老人口述整理）'
                                                        },
                                                        {
                                                            id: 1012153,
                                                            slug: 'lvren-xiejiaotan',
                                                            name: '旅人歇脚摊',
                                                            description: '有热汤、烤食、简单住宿（地铺），无名小摊数个，轮流经营，价格最低'
                                                        },
                                                        {
                                                            id: 1012154,
                                                            slug: 'lingshou-jicunchu',
                                                            name: '灵兽寄存处',
                                                            description: '代为照料旅人携带的坐骑或灵兽，收费按天，损坏赔付规则明确，靠近栈道口'
                                                        }
                                                    ]
                                                }
                                            ]
                                        },
                                        {
                                            id: 10122,
                                            slug: 'lushi-xiang',
                                            name: '炉石巷',
                                            description: '靠近西城门的一片匠人区，铁匠、皮匠、木工集中地，御桓派订制器具的主要供货来源之一'
                                        },
                                        {
                                            id: 10123,
                                            slug: 'xueyuan-shi',
                                            name: '雪鸢市',
                                            description: '外城东侧，每日卯时开市，粮食、活畜、干货的早市，玄北国最大的露天市集，严冬时改入栈道内侧'
                                        },
                                        {
                                            id: 10124,
                                            slug: 'zuibing-fang',
                                            name: '醉冰坊',
                                            description: '外城中段，靠近栈道入口，食肆集中地，酒馆、茶肆连排，旅人出发前或归来后必经之地，人流极旺',
                                            sub_locations: [
                                                {
                                                    id: 101241,
                                                    slug: 'bingquan-yufang',
                                                    name: '冰泉浴坊',
                                                    description: '以山中温泉引水的公共浴所，是凛京少有的暖意所在，男女分区，价格亲民'
                                                },
                                                {
                                                    id: 101242,
                                                    slug: 'xianyue-lou',
                                                    name: '弦月楼',
                                                    description: '外城规模最大的私营客栈兼酒楼，两层楼，可住可食，一楼设有说书台'
                                                }
                                            ]
                                        },
                                        {
                                            id: 10125,
                                            slug: 'shuangxiao-long',
                                            name: '霜绡弄',
                                            description: '内外城交界的小巷群，民间手工、织布、刺绣小作坊，玄北国特色织品「冰纱」产自此处'
                                        },
                                        {
                                            id: 10126,
                                            slug: 'xiaowu-jie',
                                            name: '晓雾街',
                                            description: '外城南端，近栈道枢纽，杂货、旧物、民间药铺，亦有少量流动摊贩，不乏来历不明的外来货物'
                                        },
                                        {
                                            id: 10127,
                                            slug: 'linjing-yiguan',
                                            name: '凛京驿馆',
                                            description: '城内唯一官办接待场所，专供外国商队与官员使用，分甲乙丙三等客房'
                                        },
                                        {
                                            id: 10128,
                                            slug: 'xuanbei-shuyuan',
                                            name: '玄北书院',
                                            description: '官办学堂，招收内外城平民子弟，教授识字、算术与基础历史，免费入学'
                                        },
                                        {
                                            id: 10131,
                                            slug: 'chenghuang-miao',
                                            name: '城隍庙',
                                            description: '供奉玄北国守护城隍神，逢年过节香火极盛，庙前广场是民间节庆的主要场所'
                                        },
                                        {
                                            id: 10132,
                                            slug: 'zhandao-hub',
                                            name: '栈道枢纽站',
                                            description: '外城西南角，连接各城区栈道的总入口，日夜有商队进出，设有货物登记处'
                                        }
                                    ]
                                },
                                {
                                    id: 1013,
                                    slug: 'chengjiao',
                                    name: '城郊',
                                    description: '凛京城墙以外的缓坡区域，地势逐渐向冰原过渡。此处有几处聚落与功能性建筑，是凛京与外界的缓冲地带。',
                                    sub_locations: [
                                        {
                                            id: 10131,
                                            slug: 'tianshu-yizhan',
                                            name: '天枢驿站',
                                            description: '城门外最大的驿站，兼具换马、补给、短期住宿功能，商队必经之地'
                                        },
                                        {
                                            id: 10132,
                                            slug: 'bingjiao-qun',
                                            name: '冰窖群',
                                            description: '城墙外侧挖凿的大型天然冰窖，储存食物与药材，由工造局统一管理'
                                        },
                                        {
                                            id: 10133,
                                            slug: 'lingshou-weichang',
                                            name: '灵兽围场',
                                            description: '圈养官府征用的大型役兽（如雪熊、冰鹿），供运输与特殊任务使用'
                                        },
                                        {
                                            id: 10134,
                                            slug: 'xingchang',
                                            name: '刑场',
                                            description: '城郊偏僻处，月初例行公开行刑，是玄北国威慑民间的传统场所'
                                        },
                                        {
                                            id: 10135,
                                            slug: 'yizhuang',
                                            name: '义庄',
                                            description: '无名亡者暂存之处，由城隍庙下属僧侣打理，逢清明节举行集体超度'
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            id: 102,
                            slug: 'xianze',
                            name: '霰泽城',
                            location_type: 'city',
                            description: '位于凛京东南方向，距凛京约半日栈道路程，建于一处矿脉丰富的山腰平台。城内以寒晶石开采与初加工为主要产业，同时有大量皮革、骨器手工坊，是御桓派炼器原材料的主要供货地之一。城区规模约为凛京外城三分之一，街道较窄，但居民多为有技艺的匠人，生活稳定。',
                            sub_locations: [
                                {
                                    id: 1021,
                                    slug: 'kuangmai-jie',
                                    name: '矿脉街',
                                    description: '沿矿道分布的原料交易街，早市最旺'
                                },
                                {
                                    id: 1022,
                                    slug: 'xianze-kuangwusuo',
                                    name: '霰泽矿务所',
                                    description: '官营矿务管理机构，负责寒晶石开采配额与税收，设有矿石质检司'
                                },
                                {
                                    id: 1023,
                                    slug: 'hanjing-chulianfang',
                                    name: '寒晶初炼坊',
                                    description: '民营寒晶石粗加工作坊数家，将原矿初步提炼为炼器可用材料，炉火终年不熄'
                                },
                                {
                                    id: 1024,
                                    slug: 'jiangren-hanghui',
                                    name: '匠人行会',
                                    description: '皮革匠、骨器匠、铁匠等行业公会驻地，负责技艺传承与纠纷仲裁，亦承接御桓派订单'
                                },
                                {
                                    id: 1025,
                                    slug: 'jichu-yiguan',
                                    name: '基础医馆',
                                    description: '为矿工与匠人提供基础医疗服务，擅长治疗矿道坍塌伤及冻伤，收费低廉'
                                }
                            ]
                        },
                        {
                            id: 103,
                            slug: 'lingdu',
                            name: '凌渡城',
                            location_type: 'city',
                            description: '位于凛京西北方向，玄北国面积最大的外围城区，占据一处较宽阔的山谷缓坡，因地势相对平坦，辟有一片有限的放牧区，饲养雪鹿、冰羊等耐寒牲畜。是玄北国与外界（经冰原驿路）最主要的商贸中转节点，外来商人若要进入玄北国，多从此处申报入境。',
                            sub_locations: [
                                {
                                    id: 1031,
                                    slug: 'dushang-jie',
                                    name: '渡商街',
                                    description: '核心街道，集中了各类中转商号、货栈、马行'
                                },
                                {
                                    id: 1032,
                                    slug: 'rujing-shenbaosuo',
                                    name: '入境申报所',
                                    description: '官营机构，负责外来商人入境登记与货物查验'
                                },
                                {
                                    id: 1033,
                                    slug: 'daxing-huozhan',
                                    name: '大型货栈',
                                    description: '数座大型仓储设施，供中转货物临时存放'
                                },
                                {
                                    id: 1034,
                                    slug: 'yima-hang',
                                    name: '驿马行',
                                    description: '提供马匹租赁与更换服务，商队必经之地'
                                },
                                {
                                    id: 1035,
                                    slug: 'bingyang-tuzai',
                                    name: '冰羊屠宰场',
                                    description: '本地冰羊集中屠宰加工处，肉品供应周边城区'
                                },
                                {
                                    id: 1036,
                                    slug: 'bianjing-shoubei',
                                    name: '边境守备营',
                                    description: '驻守凌渡城的边防军营，负责巡逻冰原驿路'
                                }
                            ]
                        },
                        {
                            id: 104,
                            slug: 'yunji',
                            name: '昀霁城',
                            location_type: 'city',
                            description: '地处玄北国地势最稳固的一处宽台，是凛京之外唯一设有官学与府衙的城区，朝廷对玄北南部区域的行政事务皆由此处分管。城区风貌较凛京更为整洁，居民以官吏、书生、医者为主，商业次于其他城区但服务业发达。',
                            sub_locations: [
                                {
                                    id: 1041,
                                    slug: 'yunming-jie',
                                    name: '昀明街',
                                    description: '核心街道，书院、书坊、文人茶馆集中地'
                                },
                                {
                                    id: 1042,
                                    slug: 'nanbu-fenfu',
                                    name: '南部分府',
                                    description: '官衙所在，处理玄北南部区域行政事务'
                                },
                                {
                                    id: 1043,
                                    slug: 'yunji-shuyuan',
                                    name: '昀霁书院',
                                    description: '最大官学，培养玄北国文官与学者'
                                },
                                {
                                    id: 1044,
                                    slug: 'dianji-guan',
                                    name: '典籍馆',
                                    description: '收藏玄北国重要文献与历史典籍'
                                },
                                {
                                    id: 1045,
                                    slug: 'xingxiang-tai',
                                    name: '星象台',
                                    description: '观测气候与星象，为农业与行军提供天象预报'
                                }
                            ]
                        },
                        {
                            id: 105,
                            slug: 'shuoling',
                            name: '朔岭城',
                            location_type: 'city',
                            description: '位于玄北国最北端，毗邻一片险峻冰原，是抵御来自北方不明威胁（据传为冰原深处的异兽群落）的军事前沿。城区以军营为主体，民用设施简陋，但因靠近冰原边缘，地下有极其丰富的冰川深水资源，是全国饮水的重要来源之一。',
                            sub_locations: [
                                {
                                    id: 1051,
                                    slug: 'junshi-jie',
                                    name: '军市街',
                                    description: '军营外侧的民间补给街，肉铺、酒馆、修缮铺为主'
                                },
                                {
                                    id: 1052,
                                    slug: 'beijing-shoubei',
                                    name: '北境守备营',
                                    description: '驻军主力所在，负责防御北方冰原威胁'
                                },
                                {
                                    id: 1053,
                                    slug: 'bingchuan-yinshui',
                                    name: '冰川水源引水站',
                                    description: '从地下冰川抽取深水，供应全国饮水'
                                },
                                {
                                    id: 1054,
                                    slug: 'jianyi-yiliao',
                                    name: '简易医疗所',
                                    description: '为军士与居民提供基础医疗服务'
                                },
                                {
                                    id: 1055,
                                    slug: 'junxie-ku',
                                    name: '军械库',
                                    description: '储存兵器与军需物资，重兵把守'
                                }
                            ]
                        },
                        {
                            id: 106,
                            slug: 'renjianshi',
                            name: '人世间',
                            location_type: 'village',
                            description: '人世间坐落于玄北国雪山最高峰，却因山顶特殊的地气涌动，常年保持如春气候，积雪不至，绿意盎然，与山腰以下的冰雪世界判若云泥。村中人只有顾姓，国民戏称「顾人间」，几百年来自给自足，以种田为业，农产品输往各城区，物美价廉，极受欢迎，村庄因此极为富裕。',
                            sub_locations: [
                                {
                                    id: 1061,
                                    slug: 'zhugan-shibanlu',
                                    name: '主干石板路',
                                    description: '村庄主轴线，两侧农舍排列，尽头为顾氏族长宅院'
                                },
                                {
                                    id: 1062,
                                    slug: 'zuzhang-zhai',
                                    name: '族长宅',
                                    description: '顾氏族长居住的宅院，是村内最大建筑，处理村务与接待贵客之所'
                                },
                                {
                                    id: 1063,
                                    slug: 'gushi-lianghang-zongcang',
                                    name: '顾氏粮行总仓',
                                    description: '储存人世间农产品的总仓库，也是对外发货的集散地'
                                },
                                {
                                    id: 1064,
                                    slug: 'cunkou-jihuotai',
                                    name: '村口集货台',
                                    description: '位于村口，供外来商贩等候与交货，设有石台数张'
                                },
                                {
                                    id: 1065,
                                    slug: 'xiaoxing-citang',
                                    name: '小型祠堂',
                                    description: '供奉顾氏先祖，村人年节祭拜之所，外人不得入内'
                                },
                                {
                                    id: 1066,
                                    slug: 'gengtian-titai',
                                    name: '耕田梯台',
                                    description: '沿山坡开辟的梯田，种植各类农作物，是村庄的主要产业'
                                },
                                {
                                    id: 1067,
                                    slug: 'jiaoyi-ting',
                                    name: '交易亭',
                                    description: '村口设施，村内顾氏成员定时来此接收外来商贩订单'
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 2,
                    slug: 'xicha',
                    name: '西刹国',
                    region_type: 'country',
                    description: '于迷雾森林中央立国，木系法术为根基，与外称男女平等。',
                    geography: '迷雾森林',
                    climate: '湿润多雾',
                    politics: '表面男女平等'
                },
                {
                    id: 3,
                    slug: 'donglan',
                    name: '东澜国',
                    region_type: 'country',
                    description: '建于滨海之地，气候四季分明。',
                    geography: '滨海之地',
                    climate: '四季分明',
                    politics: '女尊男卑'
                }
            ]
        },
        {
            id: 3,
            slug: 'immortal',
            name: '仙门',
            realm_type: 'immortal',
            description: '即有修仙之道，千年飞升。仙者，游于四方，秉善念而惩恶行，后设衢府于四国之外，便于管辖，旗下机构各司其职。',
            has_regions: true,
            regions: [
                {
                    id: 31,
                    slug: 'xuanbei-sects',
                    name: '玄北门派',
                    region_type: 'sect_group',
                    description: '位于玄北国的仙门门派，以炼器、剑修为主，适应严寒环境。',
                    locations: [
                        {
                            id: 3101,
                            slug: 'yuhuan',
                            name: '御桓派',
                            location_type: 'sect',
                            description: '玄北国凛冬不散，冰雪覆山，御桓派便踞于其中两座相邻的山峰之上，人称『双峰宗』。主峰高耸入云，冰棱倒挂于崖沿，晴日里折射出七彩光芒，远望如玉冠加冕；副峰稍低，然四时皆有煤烟升腾，那是外门弟子练习炼器时的炉火所致。两峰之间以一道铁索桥相连，桥上风烈，每逢大风，索桥便摇荡不定，然御桓派弟子往来如履平地，从不皱眉——据说新入门的外门弟子第一课便是『过桥』，吓退过不少胆小者。',
                            type: '正道',
                            speciality: '炼器/剑修',
                            sub_locations: [
                                {
                                    id: 31011,
                                    slug: 'yunmiaofeng',
                                    name: '云缈峰·主峰内门区',
                                    description: '云缈峰为主峰之首，内门弟子修炼之所皆在此处。峰上建筑以厚重的玄铁为梁，石墙间嵌有采自冰川深处的寒晶石，既能隔绝严寒，又可蓄聚灵力。廊道宽阔，两侧悬挂历代门主与优秀弟子所铸名器，每一件皆附有铭牌，记其铸造者姓名与所耗时日。内门弟子每日清晨须绕峰一圈，方可进入修炼场，铭岑大师兄向来第一个到，也是最后一个离开的那个人。'
                                },
                                {
                                    id: 31012,
                                    slug: 'ziluofeng',
                                    name: '醉落峰·主峰观景台',
                                    description: '醉落峰上有一处天然石台，三面临空，唯背后接连峰脊，是整个御桓派视野最开阔之所。玄北国的冰原在此处一览无余，晴天时可望见百里之外的东澜海岸线，化作天边一抹银光。峰主醉落惯于傍晚独坐此处，有时也带弟子前来，席地而坐，不授功法，只让弟子观天地气象，感受灵气流动。门主唐侪偶尔也会溜来此处偷懒，被千宸长老逮到后往往又少不了一顿数落。'
                                },
                                {
                                    id: 31013,
                                    slug: 'bingge',
                                    name: '藏书阁·冰阁',
                                    description: '宸潇长老常年驻守之所，建于云缈峰腰的一处背风崖壁之中，半嵌入山体，外墙以冰石封砌，终年不化。阁内以阵法恒温，步入其中反觉暖意融融，与外间风雪恍如两界。馆藏典籍浩如烟海，上至远古炼器秘方，下至各国矿脉分布图，应有尽有。宸潇长老极少离开，据说他将阁中每一册书的位置都记于心中，有弟子前来查阅，报出书名，他闭目片刻便能说出书在第几排、第几格，分毫不差。'
                                },
                                {
                                    id: 31014,
                                    slug: 'yanqianfeng',
                                    name: '烟浅峰·外门修炼场',
                                    description: '副峰之一，专供外门弟子习炼之用。峰上有数排炉台，常年炉火不熄，就算寒冬腊月，烟浅峰的积雪也化得比旁处快上许多。外门弟子在此处从最基础的锻铁开始习起，熔炼、塑形、淬火，每一道工序皆有烟浅峰主从旁指点。峰上叮叮当当的锻打声日夜不绝，初来乍到者往往要熬上半月才能习惯，睡梦里也时常被那节律分明的锤声敲醒。'
                                },
                                {
                                    id: 31015,
                                    slug: 'jingxifeng',
                                    name: '景惜峰·演武场',
                                    description: '副峰之二，外门弟子切磋比武之所。地势平坦开阔，以符文强化的石板铺就，纵使弟子对打时灵力迸发，地面也鲜少开裂。场边设有数排石墩，供观战者落座，景惜峰主时常坐于最前排，手执名册，将每一场比试的胜负与细节记录在册，一字不漏。此人性子焦躁，遇弟子表现不佳时难免声音拔高，整座副峰都能听见，门主唐侪曾戏言『景惜峰的风大，一半是天气，一半是峰主。』'
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 32,
                    slug: 'donglan-sects',
                    name: '东澜门派',
                    region_type: 'sect_group',
                    description: '位于东澜国的仙门门派，以卜策、占卜见长，临海而建。',
                    locations: [
                        {
                            id: 3201,
                            slug: 'niting',
                            name: '祢听观',
                            location_type: 'sect',
                            description: '东澜国滨海，四季分明，祢听观便建于一处面朝大海的缓坡之上，观前无遮无拦，海风长驱直入，终年不歇。观内建筑以白石为主，屋脊铺青色琉璃瓦，雨后日出时，瓦面折光如镜，有人远望误以为观顶漂浮着一片云。观门处供奉白泽神兽的石雕，据传由历任观主亲手抚摸过的石面，皆透出一种别处石料所无的温润光泽。踏入观内，空气里常有一种淡淡的焚香气息，既非沉香，亦非熏草，说不清来历，或许是卜策之气久聚不散所致。',
                            type: '正道',
                            speciality: '卜策/占卜',
                            sub_locations: [
                                {
                                    id: 32011,
                                    slug: 'tianjidian',
                                    name: '卜算台·天机殿',
                                    description: '祢听观正殿，是观主楚山澜问卦、演算天机之所。殿内正中置一张乌木卦台，台面刻满八卦纹路，年岁久远处已磨得光滑，却仍可见纹路之间的细微凹痕。殿顶开有一道圆形天窗，无论晴雨皆不遮蔽，日光月华随时序更迭投射其中，落在卦台之上，光影的角度与形状皆与卜算有关。楚山澜极少在他人在场时使用此殿，大多弟子对殿内的摆设只凭传言描绘，各有出入。'
                                },
                                {
                                    id: 32012,
                                    slug: 'shuangge',
                                    name: '观主书阁·霜阁',
                                    description: '位于天机殿之后，与正殿以一道月洞门相连。霜阁因楚山澜视力受损，室内陈设皆经过精心布置，所有物件的位置从未变动，他能以记忆精准取用每一卷典籍。阁中大半为卜策相关文献，另有司命所赠的数册孤本，以锦匣封存，轻易不示人。玉安长老偶会入阁整理，她动作极轻，生怕扰动了什么，事毕必将所有物件归置原位，一毫不差。'
                                },
                                {
                                    id: 32013,
                                    slug: 'zhanxinglou',
                                    name: '占星楼',
                                    description: '祢听观最高处，一座六角细塔，以海风为伴，常年塔顶有海鸟盘旋。楼内设有观星器械，皆为历任观主所置，或精密或古朴，年代不一，合用至今。长乐君楚云亭常在此处待至深夜，一手握着观星仪，一手执着她那惯用的零食，兴致来时便大声感叹星象，声音顺海风飘至半个观中，引得观内弟子侧目。观主曾数次嘱她收敛，她答应得痛快，第二夜照旧。'
                                },
                                {
                                    id: 32014,
                                    slug: 'yuanjiaoxi',
                                    name: '玉安教习室',
                                    description: '玉安长老授课之所，室内布置素净，几案皆以浅木制成，墙上挂有一张大幅的卜卦推演图，是玉安长老手绘，笔迹细密，历年修改处以不同色墨标注，是整幅图上唯一有色彩的存在。她教弟子时话不多，只将演算过程慢慢写于图边，让弟子自行参悟，许久无人发问，她便默默等着，室内只余笔尖落纸的轻响。上任观主仙逝之后，这间屋子多了一把旧椅，玉安长老从不坐那把椅子，却也从未将它移走。'
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 33,
                    slug: 'xisha-sects',
                    name: '西刹门派',
                    region_type: 'sect_group',
                    description: '位于西刹国的仙门门派，以炼丹、医术、驭兽闻名，隐于迷雾森林。',
                    locations: [
                        {
                            id: 3301,
                            slug: 'qinyuge',
                            name: '沁雨阁',
                            location_type: 'sect',
                            description: '西刹国森林腹地，迷雾终年不散，唯有满月之夜方得窥见林中深处的一缕缕青烟。沁雨阁便隐于此间，倚古木而建，廊庑曲折，屋脊上爬满苍翠藤蔓，远望之如同林木自行生长出的楼阁，浑然天成，难辨人工与造化之别。入阁须过一道长廊，两侧尽是药圃，各色草药依时序更迭，终年不见枯败，连空气中都弥漫着草木清苦的香气。弟子们常笑言，在沁雨阁住得久了，连呼出的气息都带了三分药味。',
                            type: '正道',
                            speciality: '炼丹/医术',
                            sub_locations: [
                                {
                                    id: 33011,
                                    slug: 'jiuchengdanding',
                                    name: '九乘丹鼎台',
                                    description: '位于沁雨阁正殿之后，乃阁内地位最为显要的所在，由太上长老亲自镇守。九座丹鼎依九宫之位排列，每一座皆高逾一人，鼎身铸有初代真君手书的草药纹路，岁月将铜绿侵染其上，反生出一种难以言说的古朴之气。台下埋有天火灵脉，常年热力涌动，地面微微烫足，鼎中炉火百年不熄。炼丹之时，九鼎同燃，火光映得半片天空泛红，远在迷雾之外的行人也能望见那抹异色，皆知沁雨阁今日又有大丹出炉。'
                                },
                                {
                                    id: 33012,
                                    slug: 'baicaoyuan',
                                    name: '药堂·百草苑',
                                    description: '百草苑由朝晖长老亲手打理，是沁雨阁最令外人称羡之处。苑中遍植奇珍药材，依药性阴阳、五行归属分区种植，各区之间以细流隔开，流水取自阁后山泉，终年清冽。其中最受瞩目的一株，是生长于苑心石台上的千年血莲参，叶脉透光如玉，朝晖长老轻易不许人靠近。每逢药材收割之期，整座百草苑香气馥郁，弟子们结伴而来，欢声笑语与草药清香混在一处，是阁中难得的热闹光景。'
                                },
                                {
                                    id: 33013,
                                    slug: 'qinglanshi',
                                    name: '教堂·晴岚室',
                                    description: '夕颜长老授课之所，名曰晴岚室，取『岚气晴日散，学问日日长』之意。室内以活木为柱，不曾截断根系，木柱下方仍与地气相连，随季节微微生长，室内的格局因此每隔数年便会悄然变动，弟子们戏称『晴岚室从不重样』。室中设有数排矮几，供弟子席地而坐，夕颜长老授课时惯于在木柱间踱步，声音不疾不徐，宛如林中流水，令人不觉便沉入其中。'
                                },
                                {
                                    id: 33014,
                                    slug: 'youguku',
                                    name: '毒堂·幽蛊窟',
                                    description: '繁缕长老所辖，地处沁雨阁最偏僻的一处山腰，以石壁凿就，常年不见天光。窟内分为制毒室、试验室与封存室三部分，以符阵隔绝气息外泄，饶是如此，每逢繁缕长老开窟研制新毒，仍有奇异的气味随风飘散，旁近的药圃里有时会莫名开出一两朵通体漆黑的奇花。彼岸花便常在此处习毒，据说她在幽蛊窟待得如鱼得水，反倒是旁人对这地方避之唯恐不及。'
                                },
                                {
                                    id: 33015,
                                    slug: 'suhuatai',
                                    name: '刑堂·素华台',
                                    description: '位于沁雨阁西侧，由濯玉长老执掌。台以白石砌成，素净得近乎冷漠，四周不植花木，唯有台沿雕有细密的锁链纹路，绕台一圈，若细看，每一节锁链纹中都刻有历任受罚者的罪状，笔迹工整，一丝不苟。阁内弟子皆知，素华台虽鲜少启用，然凡被带至此处者，无不面色大变——倒不全因刑罚之苦，更多是因濯玉长老那双平静至极的眼睛，令人浑身发寒。'
                                }
                            ]
                        },
                        {
                            id: 3302,
                            slug: 'mingan',
                            name: '溟安门',
                            location_type: 'sect',
                            description: '溟安门落于西刹国迷雾森林深处，与林中野兽比邻而居，外人鲜少知晓其确切位置。门派建筑随地势错落，有的架于巨木枝桠之间，有的半嵌于岩壁之中，廊桥藤索穿插其间，远望之如同森林自己生长出的巢穴。门内弟子与各类兽类朝夕相处，久而久之，便连步伐也悄然染上了几分野兽的轻盈。门主治门严谨，门规张贴于入口巨石之上，字迹刚劲，晴雨皆清晰可辨。',
                            type: '正道',
                            speciality: '驭兽',
                            sub_locations: [
                                {
                                    id: 33021,
                                    slug: 'zhanlinchang',
                                    name: '驭兽台·旃林场',
                                    description: '溟安门核心所在，四周以粗壮的原木为栏，围出一片宽阔空地，地面踩实，带有多年来无数兽爪与弟子足迹留下的浅痕。驭兽考核与日常训练皆在此处进行，门主亲自坐镇时，场内气氛肃穆，连惯常喧嚣的兽类也安分许多。每逢新弟子第一次驭兽，旃林场外围便会聚集不少老弟子驻足旁观，口耳相传，谁初次便驯服了烈性兽的，往往会被记上许久。'
                                },
                                {
                                    id: 33022,
                                    slug: 'baishoulang',
                                    name: '兽舍·百兽廊',
                                    description: '延伸于门派西侧的一条长廊，两旁各类兽舍依序排列，所养兽类从寻常林鸟到罕见的通灵异兽皆有。各舍以不同材质建造，蓄水兽居近溪一侧，火属性兽居石洞之中，各得其所。廊中终年弥漫着草料与兽息混合的气味，令初来者皱眉，却令门内弟子格外安心。平黎阁主负责各舍兵器供给与安防，每日清晨他独自巡廊一圈，脚步极轻，兽类见了他反而比见旁人更为平静。'
                                },
                                {
                                    id: 33023,
                                    slug: 'bingqiku',
                                    name: '平黎阁·兵器库',
                                    description: '藏于门派深处的一间石室，由平黎阁主一手掌管，非经其许可，任何人不得擅入。库内存放弟子驭兽时所用的各式兵器与辅助器械，分类摆放，整齐至近乎执拗。平黎阁主曾是外门最底层的弟子，如今守着这一片库房，待每一件兵器都比待人更为细心。有弟子曾悄悄说，平黎阁主对兵器说话时，语气比平日柔和许多。'
                                },
                                {
                                    id: 33024,
                                    slug: 'richangtang',
                                    name: '明昀阁·弟子日常堂',
                                    description: '处理门内弟子衣食起居、排班轮值、纠纷调解等日常事务的所在，由明昀阁主主持。室内案牍堆叠，却井然有序，每一份文书皆注明日期与经手人，明昀阁主虽驭兽之术平平，然将这一室杂务打理得丝毫不乱，旁人学来也难。他习惯于清晨最早到此，夜间最晚离去，茶水从来是凉的，因为总是忘记喝。'
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            id: 4,
            slug: 'underworld',
            name: '幽都',
            realm_type: 'underworld',
            description: '未尝得见天光，恰如天界另一极端，四野死寂无半点生机，遍地恶鬼游荡嚎叫凄凄，常有鬼差执杖拎灯涉行八方，偶见灯明熹微点点。',
            has_regions: false,
            locations: []
        },
        {
            id: 5,
            slug: 'demon',
            name: '妖域',
            realm_type: 'demon',
            description: '应龙陨落，坠于山野，盘桓绕尽俱沉，只余中央地域，时过境迁，逢天降甘霖不绝，围而浩瀚通海，自成孤岛，是为妖域。',
            has_regions: false,
            locations: []
        },
        {
            id: 6,
            slug: 'nanya',
            name: '南邺',
            realm_type: 'nanya',
            description: '定都赤山下，本是百姓安居乐业之盛世，却为浑渊所害，沦为其辖地，然南邺兴荣之貌与外界所传之生灵涂炭截然相反。',
            has_regions: false,
            locations: []
        }
    ],

    // 门派数据（来自xianmen_seed.json）
    sects: [
        {
            id: 1,
            name: '沁雨阁',
            slug: 'qinyuge',
            description: '西刹国森林腹地，迷雾终年不散，唯有满月之夜方得窥见林中深处的一缕缕青烟。沁雨阁便隐于此间，倚古木而建，廊庑曲折，屋脊上爬满苍翠藤蔓，远望之如同林木自行生长出的楼阁，浑然天成，难辨人工与造化之别。入阁须过一道长廊，两侧尽是药圃，各色草药依时序更迭，终年不见枯败，连空气中都弥漫着草木清苦的香气。弟子们常笑言，在沁雨阁住得久了，连呼出的气息都带了三分药味。',
            type: '正道',
            country: '西刹',
            leader_title: '阁主',
            speciality: '炼丹/医术',
            buildings: [
                {
                    name: '九乘丹鼎台',
                    slug: 'jiuchengdanding',
                    building_type: 'platform',
                    description: '位于沁雨阁正殿之后，乃阁内地位最为显要的所在，由太上长老亲自镇守。九座丹鼎依九宫之位排列，每一座皆高逾一人，鼎身铸有初代真君手书的草药纹路，岁月将铜绿侵染其上，反生出一种难以言说的古朴之气。台下埋有天火灵脉，常年热力涌动，地面微微烫足，鼎中炉火百年不熄。炼丹之时，九鼎同燃，火光映得半片天空泛红，远在迷雾之外的行人也能望见那抹异色，皆知沁雨阁今日又有大丹出炉。',
                    ruler: '太上长老',
                    access_rule: '太上长老许可方可入内。',
                    atmosphere: '炉火炽热，灵药气息馥郁，古朴庄重。',
                    visual_note: '九鼎九宫排列，铸有草药纹路，鼎身铜绿斑驳，炉火不熄。'
                },
                {
                    name: '药堂·百草苑',
                    slug: 'baicaoyuan',
                    building_type: 'courtyard',
                    description: '百草苑由朝晖长老亲手打理，是沁雨阁最令外人称羡之处。苑中遍植奇珍药材，依药性阴阳、五行归属分区种植，各区之间以细流隔开，流水取自阁后山泉，终年清冽。其中最受瞩目的一株，是生长于苑心石台上的千年血莲参，叶脉透光如玉，朝晖长老轻易不许人靠近。每逢药材收割之期，整座百草苑香气馥郁，弟子们结伴而来，欢声笑语与草药清香混在一处，是阁中难得的热闹光景。',
                    ruler: '朝晖长老',
                    access_rule: '弟子可自由进入，苑心石台区域需朝晖长老许可。',
                    atmosphere: '香气馥郁，流水潺潺，生机盎然。',
                    visual_note: '分区种植，细流隔断，苑心石台供奉千年血莲参。'
                },
                {
                    name: '教堂·晴岚室',
                    slug: 'qinglanshi',
                    building_type: 'hall',
                    description: '夕颜长老授课之所，名曰晴岚室，取『岚气晴日散，学问日日长』之意。室内以活木为柱，不曾截断根系，木柱下方仍与地气相连，随季节微微生长，室内的格局因此每隔数年便会悄然变动，弟子们戏称『晴岚室从不重样』。室中设有数排矮几，供弟子席地而坐，夕颜长老授课时惯于在木柱间踱步，声音不疾不徐，宛如林中流水，令人不觉便沉入其中。',
                    ruler: '夕颜长老',
                    access_rule: '教堂弟子及授课期间开放。',
                    atmosphere: '木香清幽，生机微动，学习氛围浓厚。',
                    visual_note: '活木为柱，矮几席地，格局随季节微变。'
                },
                {
                    name: '毒堂·幽蛊窟',
                    slug: 'youguoku',
                    building_type: 'cave',
                    description: '繁缕长老所辖，地处沁雨阁最偏僻的一处山腰，以石壁凿就，常年不见天光。窟内分为制毒室、试验室与封存室三部分，以符阵隔绝气息外泄，饶是如此，每逢繁缕长老开窟研制新毒，仍有奇异的气味随风飘散，旁近的药圃里有时会莫名开出一两朵通体漆黑的奇花。彼岸花便常在此处习毒，据说她在幽蛊窟待得如鱼得水，反倒是旁人对这地方避之唯恐不及。',
                    ruler: '繁缕长老',
                    access_rule: '繁缕长老许可方可入内，彼岸花有独立通行权。',
                    atmosphere: '阴暗幽深，符阵重重，气味诡异。',
                    visual_note: '石壁凿就，符阵封口，分三室。',
                    is_accessible: false,
                    unlock_condition: '获得繁缕长老信任或彼岸花引路'
                },
                {
                    name: '刑堂·素华台',
                    slug: 'suhuatai',
                    building_type: 'platform',
                    description: '位于沁雨阁西侧，由濯玉长老执掌。台以白石砌成，素净得近乎冷漠，四周不植花木，唯有台沿雕有细密的锁链纹路，绕台一圈，若细看，每一节锁链纹中都刻有历任受罚者的罪状，笔迹工整，一丝不苟。阁内弟子皆知，素华台虽鲜少启用，然凡被带至此处者，无不面色大变——倒不全因刑罚之苦，更多是因濯玉长老那双平静至极的眼睛，令人浑身发寒。',
                    ruler: '濯玉长老',
                    access_rule: '受罚者与监察人员进入。',
                    atmosphere: '素净冷漠，令人凛然。',
                    visual_note: '白石砌成，锁链纹路满布，刻有历代罪状。'
                }
            ],
            characters: [
                // 高位
                { name: '苏凝霜', title: '阁主', level: '高位', locations: { '长廊药圃': '◎频繁', '百草苑': '○偶尔', '晴岚室': '○偶尔', '九乘丹鼎台': '○偶尔', '幽蛊窟': '—', '素华台': '◇条件', '正殿议事': '●常驻', '寝居后院': '◎频繁' }, schedule: '日常坐镇正殿，偶出行巡视中草堂或往丹鼎台探望太上长老', personality: '温柔仁厚，待弟子如慈母', condition_triggers: { '素华台': '有弟子被押送至刑堂时出现，旁观或干预' } },
                { name: '谢冽霜', title: '副阁主', level: '高位', locations: { '长廊药圃': '●常驻', '百草苑': '○偶尔', '晴岚室': '○偶尔', '九乘丹鼎台': '—', '幽蛊窟': '—', '素华台': '◇条件', '正殿议事': '◎频繁', '寝居后院': '◎频繁' }, schedule: '掌中草堂事务，日常处理各地中草堂往来文书', personality: '冷静自持，执法严明', condition_triggers: { '素华台': '重大违规处置时才会现身' } },
                { name: '叶承煦', title: '太上长老', level: '高位', locations: { '长廊药圃': '—', '百草苑': '—', '晴岚室': '—', '九乘丹鼎台': '●常驻', '幽蛊窟': '—', '素华台': '—', '正殿议事': '○偶尔', '寝居后院': '○偶尔' }, schedule: '镇守九乘丹鼎，极少离开', personality: '温润儒雅，控火之术登峰造极' },
                // 中位
                { name: '苏微澜', title: '少阁主', level: '中位', locations: { '长廊药圃': '◎频繁', '百草苑': '○偶尔', '晴岚室': '○偶尔', '九乘丹鼎台': '○偶尔', '幽蛊窟': '○偶尔', '素华台': '—', '正殿议事': '○偶尔', '寝居后院': '◎频繁' }, schedule: '随阁主学习处理门派事务，偶往各处巡视', personality: '沉稳早慧，已有未来阁主气度' },
                { name: '沈暖芜', title: '朝晖长老', level: '中位', locations: { '长廊药圃': '○偶尔', '百草苑': '●常驻', '晴岚室': '○偶尔', '九乘丹鼎台': '—', '幽蛊窟': '—', '素华台': '—', '正殿议事': '○偶尔', '寝居后院': '◎频繁' }, schedule: '打理百草苑，培育珍稀药材', personality: '温暖开朗，对药材近乎痴迷' },
                { name: '裴晚吟', title: '夕颜长老', level: '中位', locations: { '长廊药圃': '○偶尔', '百草苑': '○偶尔', '晴岚室': '●常驻', '九乘丹鼎台': '—', '幽蛊窟': '—', '素华台': '—', '正殿议事': '○偶尔', '寝居后院': '◎频繁' }, schedule: '教堂授课，培育弟子', personality: '端庄沉静，教学循循善诱' },
                { name: '顾寒璋', title: '濯玉长老', level: '中位', locations: { '长廊药圃': '○偶尔', '百草苑': '—', '晴岚室': '—', '九乘丹鼎台': '—', '幽蛊窟': '—', '素华台': '●常驻', '正殿议事': '◎频繁', '寝居后院': '◎频繁' }, schedule: '执掌刑堂，执法监察', personality: '冷峻刚直，铁面无私' },
                { name: '林幽蔓', title: '繁缕长老', level: '中位', locations: { '长廊药圃': '—', '百草苑': '◇条件', '晴岚室': '—', '九乘丹鼎台': '—', '幽蛊窟': '●常驻', '素华台': '—', '正殿议事': '○偶尔', '寝居后院': '◎频繁' }, schedule: '研毒制毒，教导彼岸花', personality: '神秘莫测，对毒学近乎疯狂', condition_triggers: { '百草苑': '采集特殊药材原料时方至' } },
                { name: '方晏清', title: '泽曦长老', level: '中位', locations: { '长廊药圃': '—', '百草苑': '○偶尔', '晴岚室': '—', '九乘丹鼎台': '◎频繁', '幽蛊窟': '—', '素华台': '—', '正殿议事': '○偶尔', '寝居后院': '◎频繁' }, schedule: '掌丹堂，炼丹制药', personality: '温和专注，对炼丹近乎虔诚' },
                // 低位
                { name: '殷冥棠', title: '彼岸花', level: '低位', locations: { '长廊药圃': '○偶尔', '百草苑': '○偶尔', '晴岚室': '—', '九乘丹鼎台': '—', '幽蛊窟': '●常驻', '素华台': '—', '正殿议事': '—', '寝居后院': '○偶尔' }, schedule: '随繁缕长老习毒，偶尔外出', personality: '慵懒散漫，用毒精准狠辣' },
                { name: '祁朗舟', title: '风信子', level: '低位', locations: { '长廊药圃': '○偶尔', '百草苑': '○偶尔', '晴岚室': '◎频繁', '九乘丹鼎台': '◎频繁', '幽蛊窟': '—', '素华台': '—', '正殿议事': '—', '寝居后院': '○偶尔' }, schedule: '随泽曦长老习炼丹，常往各处送丹药', personality: '开朗话多，精力充沛' },
                { name: '温瑶枝', title: '蝴蝶兰', level: '低位', locations: { '长廊药圃': '○偶尔', '百草苑': '○偶尔', '晴岚室': '◎频繁', '九乘丹鼎台': '—', '幽蛊窟': '○偶尔', '素华台': '—', '正殿议事': '—', '寝居后院': '○偶尔' }, schedule: '随副阁主习针灸，偶往教堂请教', personality: '沉静温柔，极善倾听' },
                // 批量角色
                { name: '中草堂丹师×10', title: '中草堂丹师', level: '低位', locations: { '长廊药圃': '—', '百草苑': '○偶尔', '晴岚室': '○偶尔', '九乘丹鼎台': '◎频繁', '幽蛊窟': '—', '素华台': '—', '正殿议事': '○偶尔', '寝居后院': '○偶尔' }, schedule: '协助炼丹制药', personality: '普通丹师' },
                { name: '内门弟子×10', title: '内门弟子', level: '低位', locations: { '长廊药圃': '◎频繁', '百草苑': '◎频繁', '晴岚室': '●常驻', '九乘丹鼎台': '◎频繁', '幽蛊窟': '◇条件', '素华台': '—', '正殿议事': '—', '寝居后院': '◎频繁' }, schedule: '随长老学习修炼', personality: '普通内门弟子' },
                { name: '外门弟子×n', title: '外门弟子', level: '低位', locations: { '长廊药圃': '●常驻', '百草苑': '◎频繁', '晴岚室': '◎频繁', '九乘丹鼎台': '○偶尔', '幽蛊窟': '—', '素华台': '—', '正殿议事': '—', '寝居后院': '○偶尔' }, schedule: '日常劳作与基础修炼', personality: '普通外门弟子' }
            ]
        },
        {
            id: 2,
            name: '御桓派',
            slug: 'yuhuan',
            description: '玄北国凛冬不散，冰雪覆山，御桓派便踞于其中两座相邻的山峰之上，人称『双峰宗』。主峰高耸入云，冰棱倒挂于崖沿，晴日里折射出七彩光芒，远望如玉冠加冕；副峰稍低，然四时皆有煤烟升腾，那是外门弟子练习炼器时的炉火所致。两峰之间以一道铁索桥相连，桥上风烈，每逢大风，索桥便摇荡不定，然御桓派弟子往来如履平地，从不皱眉——据说新入门的外门弟子第一课便是『过桥』，吓退过不少胆小者。',
            type: '正道',
            country: '玄北',
            leader_title: '门主',
            leader_name: '唐侪',
            speciality: '炼器/剑修',
            buildings: [
                {
                    name: '云缈峰·主峰内门区',
                    slug: 'yunmiaofeng',
                    building_type: 'peak',
                    description: '云缈峰为主峰之首，内门弟子修炼之所皆在此处。峰上建筑以厚重的玄铁为梁，石墙间嵌有采自冰川深处的寒晶石，既能隔绝严寒，又可蓄聚灵力。廊道宽阔，两侧悬挂历代门主与优秀弟子所铸名器，每一件皆附有铭牌，记其铸造者姓名与所耗时日。内门弟子每日清晨须绕峰一圈，方可进入修炼场，铭岑大师兄向来第一个到，也是最后一个离开的那个人。',
                    ruler: '云缈峰主',
                    access_rule: '内门弟子方可进入。',
                    atmosphere: '寒气凛冽，灵气充盈，竞争氛围浓厚。'
                },
                {
                    name: '醉落峰·主峰观景台',
                    slug: 'ziluofeng',
                    building_type: 'peak',
                    description: '醉落峰上有一处天然石台，三面临空，唯背后接连峰脊，是整个御桓派视野最开阔之所。玄北国的冰原在此处一览无余，晴天时可望见百里之外的东澜海岸线，化作天边一抹银光。峰主醉落惯于傍晚独坐此处，有时也带弟子前来，席地而坐，不授功法，只让弟子观天地气象，感受灵气流动。门主唐侪偶尔也会溜来此处偷懒，被千宸长老逮到后往往又少不了一顿数落。',
                    ruler: '醉落峰主',
                    access_rule: '弟子可自由前往。',
                    atmosphere: '视野开阔，寒风凛冽，令人心旷神怡。'
                },
                {
                    name: '藏书阁·冰阁',
                    slug: 'binggejcs',
                    building_type: 'tower',
                    description: '宸潇长老常年驻守之所，建于云缈峰腰的一处背风崖壁之中，半嵌入山体，外墙以冰石封砌，终年不化。阁内以阵法恒温，步入其中反觉暖意融融，与外间风雪恍如两界。馆藏典籍浩如烟海，上至远古炼器秘方，下至各国矿脉分布图，应有尽有。宸潇长老极少离开，据说他将阁中每一册书的位置都记于心中，有弟子前来查阅，报出书名，他闭目片刻便能说出书在第几排、第几格，分毫不差。',
                    ruler: '宸潇长老',
                    access_rule: '弟子可入，内层典籍需申请。',
                    atmosphere: '外寒内暖，书香沉静，宸潇长老永远在某处角落。'
                },
                {
                    name: '烟浅峰·外门修炼场',
                    slug: 'yanqianfeng',
                    building_type: 'peak',
                    description: '副峰之一，专供外门弟子习炼之用。峰上有数排炉台，常年炉火不熄，就算寒冬腊月，烟浅峰的积雪也化得比旁处快上许多。外门弟子在此处从最基础的锻铁开始习起，熔炼、塑形、淬火，每一道工序皆有烟浅峰主从旁指点。峰上叮叮当当的锻打声日夜不绝，初来乍到者往往要熬上半月才能习惯，睡梦里也时常被那节律分明的锤声敲醒。',
                    ruler: '烟浅峰主',
                    access_rule: '外门弟子开放。',
                    atmosphere: '炉火炽热，锤声不绝，充满烟火气息。'
                },
                {
                    name: '景惜峰·演武场',
                    slug: 'jingxifeng',
                    building_type: 'courtyard',
                    description: '副峰之二，外门弟子切磋比武之所。地势平坦开阔，以符文强化的石板铺就，纵使弟子对打时灵力迸发，地面也鲜少开裂。场边设有数排石墩，供观战者落座，景惜峰主时常坐于最前排，手执名册，将每一场比试的胜负与细节记录在册，一字不漏。此人性子焦躁，遇弟子表现不佳时难免声音拔高，整座副峰都能听见，门主唐侪曾戏言『景惜峰的风大，一半是天气，一半是峰主。』',
                    ruler: '景惜峰主',
                    access_rule: '外门弟子开放。',
                    atmosphere: '嘈杂激烈，喊声与锻打声交织，充满竞争气息。'
                },

            ],
            characters: [
                // 高位
                { name: '唐侪', title: '门主', level: '高位', locations: { '云缈峰修炼场': '○偶尔', '醉落峰观景台': '◎频繁', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '○偶尔', '景惜峰演武场': '○偶尔', '峰间铁索桥': '◎频繁', '门主殿议事': '●常驻', '寝居': '◎频繁' }, schedule: '游走各峰巡视，偶往醉落峰观景台偷懒，常被千宸长老逮到', personality: '表面玩世不恭，内里重情重义' },
                { name: '陈济', title: '千宸长老', level: '高位', locations: { '云缈峰修炼场': '○偶尔', '醉落峰观景台': '—', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '—', '景惜峰演武场': '○偶尔', '峰间铁索桥': '○偶尔', '门主殿议事': '◎频繁', '寝居': '◎频繁' }, schedule: '掌执法监察，多在门主殿与冰阁之间，时常被门主惹怒', personality: '冷硬刻板，嘴硬心软' },
                { name: '燕沉玺', title: '清霄长老', level: '高位', locations: { '云缈峰修炼场': '○偶尔', '醉落峰观景台': '◎频繁', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '—', '景惜峰演武场': '—', '峰间铁索桥': '◎频繁', '门主殿议事': '◎频繁', '寝居': '◎频繁' }, schedule: '掌外交事务，偶抚琴，常往来各峰', personality: '温润如玉，长袖善舞' },
                { name: '沈霁云', title: '宸潇长老', level: '高位', locations: { '云缈峰修炼场': '—', '醉落峰观景台': '—', '冰阁藏书阁': '●常驻', '烟浅峰炉台': '—', '景惜峰演武场': '—', '峰间铁索桥': '—', '门主殿议事': '○偶尔', '寝居': '○偶尔' }, schedule: '镇守藏书阁，极少离开', personality: '淡泊寡欲，内功深厚' },
                // 中位
                { name: '江凌鹤', title: '云缈峰主', level: '中位', locations: { '云缈峰修炼场': '●常驻', '醉落峰观景台': '—', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '—', '景惜峰演武场': '—', '峰间铁索桥': '○偶尔', '门主殿议事': '○偶尔', '寝居': '◎频繁' }, schedule: '掌云缈峰，培育内门弟子', personality: '对弟子严格，要求极高' },
                { name: '谢怀朴', title: '醉落峰主', level: '中位', locations: { '云缈峰修炼场': '◎频繁', '醉落峰观景台': '●常驻', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '—', '景惜峰演武场': '—', '峰间铁索桥': '○偶尔', '门主殿议事': '○偶尔', '寝居': '◎频繁' }, schedule: '掌醉落峰，与云缈峰主搭档', personality: '平易近人，随和好说话' },
                { name: '顾微澹', title: '烟浅峰主', level: '中位', locations: { '云缈峰修炼场': '○偶尔', '醉落峰观景台': '—', '冰阁藏书阁': '—', '烟浅峰炉台': '●常驻', '景惜峰演武场': '—', '峰间铁索桥': '○偶尔', '门主殿议事': '○偶尔', '寝居': '◎频繁' }, schedule: '掌烟浅峰，发掘外门弟子', personality: '精明干练，账目清晰' },
                { name: '裴烈川', title: '景惜峰主', level: '中位', locations: { '云缈峰修炼场': '○偶尔', '醉落峰观景台': '—', '冰阁藏书阁': '—', '烟浅峰炉台': '—', '景惜峰演武场': '●常驻', '峰间铁索桥': '○偶尔', '门主殿议事': '○偶尔', '寝居': '◎频繁' }, schedule: '掌景惜峰，记录弟子比武', personality: '性子焦躁，对门主忠诚' },
                { name: '白拾璃', title: '渡寒峰主', level: '中位', locations: { '云缈峰修炼场': '○偶尔', '醉落峰观景台': '—', '冰阁藏书阁': '◎频繁', '烟浅峰炉台': '○偶尔', '景惜峰演武场': '○偶尔', '峰间铁索桥': '○偶尔', '门主殿议事': '●常驻', '寝居': '◎频繁' }, schedule: '掌渡寒峰，管理资源调配', personality: '精明干练，说话直接' },
                { name: '萧远鸿', title: '供奉长老', level: '中位', locations: { '云缈峰修炼场': '—', '醉落峰观景台': '○偶尔', '冰阁藏书阁': '—', '烟浅峰炉台': '—', '景惜峰演武场': '—', '峰间铁索桥': '—', '门主殿议事': '◇条件', '寝居': '◇条件' }, schedule: '常年游历四方，门派有难方回', personality: '傲骨难藏，不服软', condition_triggers: { '门主殿议事': '门派有难时才会出现', '寝居': '门派有难时才会出现' } },
                // 低位
                { name: '陆铭岑', title: '内门大弟子', level: '低位', locations: { '云缈峰修炼场': '●常驻', '醉落峰观景台': '○偶尔', '冰阁藏书阁': '◎频繁', '烟浅峰炉台': '○偶尔', '景惜峰演武场': '◎频繁', '峰间铁索桥': '◎频繁', '门主殿议事': '○偶尔', '寝居': '◎频繁' }, schedule: '修炼与协助管理内门事务', personality: '沉稳内敛，天资极高' },
                { name: '林千俞', title: '云缈峰弟子', level: '低位', locations: { '云缈峰修炼场': '●常驻', '醉落峰观景台': '○偶尔', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '—', '景惜峰演武场': '○偶尔', '峰间铁索桥': '○偶尔', '门主殿议事': '—', '寝居': '◎频繁' }, schedule: '随师父修炼，追赶大师兄', personality: '天资出众，要强不服输' },
                { name: '方溯汶', title: '景惜峰弟子', level: '低位', locations: { '云缈峰修炼场': '○偶尔', '醉落峰观景台': '—', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '—', '景惜峰演武场': '●常驻', '峰间铁索桥': '○偶尔', '门主殿议事': '—', '寝居': '◎频繁' }, schedule: '随师父修炼，性子温和', personality: '性子温和，有自己的想法' },
                { name: '苏御', title: '内门管事', level: '低位', locations: { '云缈峰修炼场': '◎频繁', '醉落峰观景台': '—', '冰阁藏书阁': '○偶尔', '烟浅峰炉台': '—', '景惜峰演武场': '○偶尔', '峰间铁索桥': '○偶尔', '门主殿议事': '●常驻', '寝居': '◎频繁' }, schedule: '打理内门事务，与洛尘配合', personality: '寡言少语，做事干脆利落' },
                { name: '洛尘', title: '外门管事', level: '低位', locations: { '云缈峰修炼场': '—', '醉落峰观景台': '—', '冰阁藏书阁': '—', '烟浅峰炉台': '◎频繁', '景惜峰演武场': '◎频繁', '峰间铁索桥': '◎频繁', '门主殿议事': '○偶尔', '寝居': '○偶尔' }, schedule: '打理外门事务，与苏御配合', personality: '话多开朗，善于沟通' },
                // 批量角色
                { name: '内门弟子×n', title: '内门弟子', level: '低位', locations: { '云缈峰修炼场': '●常驻', '醉落峰观景台': '◎频繁', '冰阁藏书阁': '◎频繁', '烟浅峰炉台': '—', '景惜峰演武场': '◎频繁', '峰间铁索桥': '◎频繁', '门主殿议事': '—', '寝居': '◎频繁' }, schedule: '随长老学习修炼', personality: '普通内门弟子' },
                { name: '外门弟子×n', title: '外门弟子', level: '低位', locations: { '云缈峰修炼场': '—', '醉落峰观景台': '—', '冰阁藏书阁': '—', '烟浅峰炉台': '●常驻', '景惜峰演武场': '●常驻', '峰间铁索桥': '◎频繁', '门主殿议事': '—', '寝居': '○偶尔' }, schedule: '日常劳作与基础修炼', personality: '普通外门弟子' }
            ]
        },
        {
            id: 3,
            name: '祢听观',
            slug: 'niting',
            description: '东澜国滨海，四季分明，祢听观便建于一处面朝大海的缓坡之上，观前无遮无拦，海风长驱直入，终年不歇。观内建筑以白石为主，屋脊铺青色琉璃瓦，雨后日出时，瓦面折光如镜，有人远望误以为观顶漂浮着一片云。观门处供奉白泽神兽的石雕，据传由历任观主亲手抚摸过的石面，皆透出一种别处石料所无的温润光泽。踏入观内，空气里常有一种淡淡的焚香气息，既非沉香，亦非熏草，说不清来历，或许是卜策之气久聚不散所致。',
            type: '正道',
            country: '东澜',
            leader_title: '观主',
            leader_name: '楚山澜',
            speciality: '卜策/占卜',
            buildings: [
                {
                    name: '卜算台·天机殿',
                    slug: 'tianji',
                    building_type: 'hall',
                    description: '祢听观正殿，是观主楚山澜问卦、演算天机之所。殿内正中置一张乌木卦台，台面刻满八卦纹路，年岁久远处已磨得光滑，却仍可见纹路之间的细微凹痕。殿顶开有一道圆形天窗，无论晴雨皆不遮蔽，日光月华随时序更迭投射其中，落在卦台之上，光影的角度与形状皆与卜算有关。楚山澜极少在他人在场时使用此殿，大多弟子对殿内的摆设只凭传言描绘，各有出入。',
                    ruler: '楚山澜',
                    access_rule: '极少允许他人在场，大事方开。',
                    atmosphere: '肃穆神秘，天光落台，时间感模糊。',
                    visual_note: '乌木卦台，圆形天窗，光影角度与卜算相关。'
                },
                {
                    name: '观主书阁·霜阁',
                    slug: 'shuangge',
                    building_type: 'pavilion',
                    description: '位于天机殿之后，与正殿以一道月洞门相连。霜阁因楚山澜视力受损，室内陈设皆经过精心布置，所有物件的位置从未变动，他能以记忆精准取用每一卷典籍。阁中大半为卜策相关文献，另有司命所赠的数册孤本，以锦匣封存，轻易不示人。玉安长老偶会入阁整理，她动作极轻，生怕扰动了什么，事毕必将所有物件归置原位，一毫不差。',
                    ruler: '楚山澜',
                    access_rule: '观主私人书阁，玉安长老有整理权限。',
                    atmosphere: '静谧，书香，锦匣隐秘，一切按记忆排列。',
                    visual_note: '陈设固定，锦匣封存孤本，月洞门连天机殿。'
                },
                {
                    name: '占星楼',
                    slug: 'zhanxing',
                    building_type: 'tower',
                    description: '祢听观最高处，一座六角细塔，以海风为伴，常年塔顶有海鸟盘旋。楼内设有观星器械，皆为历任观主所置，或精密或古朴，年代不一，合用至今。长乐君楚云亭常在此处待至深夜，一手握着观星仪，一手执着她那惯用的零食，兴致来时便大声感叹星象，声音顺海风飘至半个观中，引得观内弟子侧目。观主曾数次嘱她收敛，她答应得痛快，第二夜照旧。',
                    ruler: '长乐君楚云亭（常驻）',
                    access_rule: '弟子可上，夜间为长乐君私人时段。',
                    atmosphere: '海风猎猎，视野开阔，器械古朴，星光明亮。',
                    visual_note: '六角细塔，观星仪械错落，海鸟常绕。'
                },
                {
                    name: '玉安教习室',
                    slug: 'yuanjiaoxi',
                    building_type: 'hall',
                    description: '玉安长老授课之所，室内布置素净，几案皆以浅木制成，墙上挂有一张大幅的卜卦推演图，是玉安长老手绘，笔迹细密，历年修改处以不同色墨标注，是整幅图上唯一有色彩的存在。她教弟子时话不多，只将演算过程慢慢写于图边，让弟子自行参悟，许久无人发问，她便默默等着，室内只余笔尖落纸的轻响。上任观主仙逝之后，这间屋子多了一把旧椅，玉安长老从不坐那把椅子，却也从未将它移走。',
                    ruler: '玉安长老',
                    access_rule: '教堂弟子及授课期间开放。',
                    atmosphere: '素净安静，书香弥漫，学习氛围浓厚。',
                    visual_note: '浅木几案，大幅推演图，旧椅静置一隅。'
                }
            ],
            characters: [
                // 高位
                { name: '楚山澜', title: '观主', level: '高位', locations: { '天机殿': '●常驻', '霜阁': '◎频繁', '占星楼': '○偶尔', '教习室': '—', '观门白泽': '○偶尔', '庭院廊道': '○偶尔', '接引外务室': '—', '寝居': '◎频繁' }, schedule: '多在天机殿问卦演算，偶在霜阁整理典籍，极少外出', personality: '清冷出尘，寡言少语，内里偏执入骨', condition_triggers: { '天机殿': '正殿内几乎全天，极少外出，询问大事方移步他处' } },
                { name: '纪玉安', title: '玉安长老', level: '高位', locations: { '天机殿': '—', '霜阁': '◎频繁', '占星楼': '—', '教习室': '●常驻', '观门白泽': '○偶尔', '庭院廊道': '◎频繁', '接引外务室': '○偶尔', '寝居': '◎频繁' }, schedule: '授课与处理观内诸务，偶往霜阁整理', personality: '生性内敛，安静惯了' },
                { name: '贝玉骋', title: '玉骋长老', level: '高位', locations: { '天机殿': '—', '霜阁': '—', '占星楼': '○偶尔', '教习室': '—', '观门白泽': '○偶尔', '庭院廊道': '●常驻', '接引外务室': '○偶尔', '寝居': '◎频繁' }, schedule: '常年在外行走，偶回观中', personality: '性情暴躁，不通人心' },
                // 中位
                { name: '顾明玉', title: '明玉阁主', level: '中位', locations: { '天机殿': '—', '霜阁': '—', '占星楼': '—', '教习室': '●常驻', '观门白泽': '—', '庭院廊道': '◎频繁', '接引外务室': '◎频繁', '寝居': '◎频繁' }, schedule: '掌明玉阁，教导弟子', personality: '清心寡欲，对弟子要求极高' },
                // 低位
                { name: '楚云亭', title: '长乐君', level: '中位', locations: { '天机殿': '—', '霜阁': '—', '占星楼': '●常驻', '教习室': '—', '观门白泽': '◎频繁', '庭院廊道': '◎频繁', '接引外务室': '●常驻', '寝居': '◎频繁' }, schedule: '白日处理接引事务，夜间多在占星楼观星', personality: '豁达大度，洒脱随性' },
                { name: '裴听澜', title: '大师兄', level: '低位', locations: { '天机殿': '○偶尔', '霜阁': '○偶尔', '占星楼': '—', '教习室': '◎频繁', '观门白泽': '○偶尔', '庭院廊道': '◎频繁', '接引外务室': '○偶尔', '寝居': '◎频繁' }, schedule: '随师父处理观内事务，观察入微', personality: '自由散漫，最是了解观主' },
                { name: '温昼声', title: '玉骋之徒', level: '低位', locations: { '天机殿': '—', '霜阁': '—', '占星楼': '○偶尔', '教习室': '○偶尔', '观门白泽': '◎频繁', '庭院廊道': '●常驻', '接引外务室': '○偶尔', '寝居': '◎频繁' }, schedule: '随师父外出，偶在观中', personality: '急躁，藏不住火' },
                { name: '姜细雨', title: '明玉之徒', level: '低位', locations: { '天机殿': '—', '霜阁': '—', '占星楼': '○偶尔', '教习室': '◎频繁', '观门白泽': '—', '庭院廊道': '◎频繁', '接引外务室': '—', '寝居': '◎频繁' }, schedule: '随明玉阁主习卜策', personality: '安静，话少，存在感极低' },
                // 批量角色
                { name: '内门弟子×4', title: '内门弟子', level: '低位', locations: { '天机殿': '○偶尔', '霜阁': '—', '占星楼': '○偶尔', '教习室': '●常驻', '观门白泽': '○偶尔', '庭院廊道': '◎频繁', '接引外务室': '○偶尔', '寝居': '◎频繁' }, schedule: '随长老学习修炼', personality: '普通内门弟子' },
                { name: '外门弟子×n', title: '外门弟子', level: '低位', locations: { '天机殿': '—', '霜阁': '—', '占星楼': '◎频繁', '教习室': '◎频繁', '观门白泽': '◎频繁', '庭院廊道': '●常驻', '接引外务室': '○偶尔', '寝居': '○偶尔' }, schedule: '日常劳作与基础修炼', personality: '普通外门弟子' }
            ]
        },
        {
            id: 4,
            name: '溟安门',
            slug: 'mingan',
            description: '溟安门落于西刹国迷雾森林深处，与林中野兽比邻而居，外人鲜少知晓其确切位置。门派建筑随地势错落，有的架于巨木枝桠之间，有的半嵌于岩壁之中，廊桥藤索穿插其间，远望之如同森林自己生长出的巢穴。门内弟子与各类兽类朝夕相处，久而久之，便连步伐也悄然染上了几分野兽的轻盈。门主治门严谨，门规张贴于入口巨石之上，字迹刚劲，晴雨皆清晰可辨。',
            type: '正道',
            country: '西刹',
            leader_title: '门主',
            speciality: '驭兽',
            buildings: [
                {
                    name: '驭兽台·旃林场',
                    slug: 'zhanlinchang',
                    building_type: 'courtyard',
                    description: '溟安门核心所在，四周以粗壮的原木为栏，围出一片宽阔空地，地面踩实，带有多年来无数兽爪与弟子足迹留下的浅痕。驭兽考核与日常训练皆在此处进行，门主亲自坐镇时，场内气氛肃穆，连惯常喧嚣的兽类也安分许多。每逢新弟子第一次驭兽，旃林场外围便会聚集不少老弟子驻足旁观，口耳相传，谁初次便驯服了烈性兽的，往往会被记上许久。',
                    ruler: '门主',
                    access_rule: '弟子可自由使用，考核时由长老主持。',
                    atmosphere: '野性与肃穆并存，兽与人的气息混杂。'
                },
                {
                    name: '兽舍·百兽廊',
                    slug: 'baisoulang',
                    building_type: 'hall',
                    description: '延伸于门派西侧的一条长廊，两旁各类兽舍依序排列，所养兽类从寻常林鸟到罕见的通灵异兽皆有。各舍以不同材质建造，蓄水兽居近溪一侧，火属性兽居石洞之中，各得其所。廊中终年弥漫着草料与兽息混合的气味，令初来者皱眉，却令门内弟子格外安心。平黎阁主负责各舍兵器供给与安防，每日清晨他独自巡廊一圈，脚步极轻，兽类见了他反而比见旁人更为平静。',
                    ruler: '平黎阁主（兽舍安防）',
                    access_rule: '弟子可进入，部分高危异兽区域受限。',
                    atmosphere: '气味浓烈，兽声此起彼伏，却有一种奇异的安宁。'
                },
                {
                    name: '平黎阁·兵器库',
                    slug: 'pinglige',
                    building_type: 'warehouse',
                    description: '藏于门派深处的一间石室，由平黎阁主一手掌管，非经其许可，任何人不得擅入。库内存放弟子驭兽时所用的各式兵器与辅助器械，分类摆放，整齐至近乎执拗。平黎阁主曾是外门最底层的弟子，如今守着这一片库房，待每一件兵器都比待人更为细心。有弟子曾悄悄说，平黎阁主对兵器说话时，语气比平日柔和许多。',
                    ruler: '平黎阁主',
                    access_rule: '需平黎阁主许可方可进入。',
                    atmosphere: '肃穆安静，兵器陈列整齐，充满金属气息。'
                },
                {
                    name: '明昀阁·弟子日常堂',
                    slug: 'mingyunge',
                    building_type: 'hall',
                    description: '处理门内弟子衣食起居、排班轮值、纠纷调解等日常事务的所在，由明昀阁主主持。室内案牍堆叠，却井然有序，每一份文书皆注明日期与经手人，明昀阁主虽驭兽之术平平，然将这一室杂务打理得丝毫不乱，旁人学来也难。他习惯于清晨最早到此，夜间最晚离去，茶水从来是凉的，因为总是忘记喝。',
                    ruler: '明昀阁主',
                    access_rule: '弟子可自由进入。',
                    atmosphere: '井然有序，文书气息，安静而忙碌。'
                }
            ],
            characters: [
                // 高位
                { name: '卫烈霜', title: '溟安门主', level: '高位', locations: { '旃林场': '●常驻', '百兽廊': '○偶尔', '平黎兵器库': '○偶尔', '明昀日常堂': '○偶尔', '门口巨石': '○偶尔', '林间廊桥': '○偶尔', '门主室议事': '●常驻', '寝居': '◎频繁' }, schedule: '坐镇旃林场，偶往各处巡视', personality: '刚正不阿，说一不二' },
                { name: '沈兆元', title: '兆元长老', level: '高位', locations: { '旃林场': '◎频繁', '百兽廊': '○偶尔', '平黎兵器库': '○偶尔', '明昀日常堂': '●常驻', '门口巨石': '○偶尔', '林间廊桥': '○偶尔', '门主室议事': '◎频繁', '寝居': '◎频繁' }, schedule: '辅佐门主处理门派事务', personality: '精明能干，温温和和' },
                { name: '霍珉怀', title: '珉怀长老', level: '高位', locations: { '旃林场': '—', '百兽廊': '—', '平黎兵器库': '—', '明昀日常堂': '—', '门口巨石': '—', '林间廊桥': '—', '门主室议事': '◇条件', '寝居': '○偶尔' }, schedule: '长期闭关养伤，极少出关', personality: '沉静，话少，看得淡', condition_triggers: { '门主室议事': '偶出关露面，极少主动求见，病情好转时偶至' } },
                // 中位
                { name: '厉平黎', title: '平黎阁主', level: '中位', locations: { '旃林场': '○偶尔', '百兽廊': '●常驻', '平黎兵器库': '●常驻', '明昀日常堂': '—', '门口巨石': '—', '林间廊桥': '○偶尔', '门主室议事': '○偶尔', '寝居': '◎频繁' }, schedule: '掌管兵器库与兽舍安防', personality: '不信任人，做事利落' },
                { name: '祁明昀', title: '明昀阁主', level: '中位', locations: { '旃林场': '—', '百兽廊': '—', '平黎兵器库': '—', '明昀日常堂': '●常驻', '门口巨石': '○偶尔', '林间廊桥': '—', '门主室议事': '○偶尔', '寝居': '◎频繁' }, schedule: '处理弟子日常事务', personality: '把事情做好，不声张' },
                // 低位
                { name: '江朔风', title: '门主大弟子', level: '低位', locations: { '旃林场': '●常驻', '百兽廊': '◎频繁', '平黎兵器库': '○偶尔', '明昀日常堂': '○偶尔', '门口巨石': '◎频繁', '林间廊桥': '◎频繁', '门主室议事': '○偶尔', '寝居': '◎频繁' }, schedule: '随师父修炼，协助管理弟子', personality: '沉稳内敛，极有责任心' },
                { name: '宋暖霁', title: '门主二弟子', level: '低位', locations: { '旃林场': '◎频繁', '百兽廊': '◎频繁', '平黎兵器库': '○偶尔', '明昀日常堂': '○偶尔', '门口巨石': '○偶尔', '林间廊桥': '◎频繁', '门主室议事': '—', '寝居': '◎频繁' }, schedule: '随师父修炼，与大师兄搭档', personality: '豁达乐观，喜欢帮人' },
                { name: '贺凛冬', title: '门主三弟子', level: '低位', locations: { '旃林场': '●常驻', '百兽廊': '○偶尔', '平黎兵器库': '○偶尔', '明昀日常堂': '—', '门口巨石': '○偶尔', '林间廊桥': '◎频繁', '门主室议事': '—', '寝居': '◎频繁' }, schedule: '随师父修炼，刻苦异常', personality: '看着薄情，实则重义' },
                // 批量角色
                { name: '内门弟子×3', title: '内门弟子', level: '低位', locations: { '旃林场': '●常驻', '百兽廊': '◎频繁', '平黎兵器库': '○偶尔', '明昀日常堂': '○偶尔', '门口巨石': '○偶尔', '林间廊桥': '◎频繁', '门主室议事': '—', '寝居': '◎频繁' }, schedule: '随长老学习修炼', personality: '普通内门弟子' },
                { name: '外门弟子×n', title: '外门弟子', level: '低位', locations: { '旃林场': '●常驻', '百兽廊': '◎频繁', '平黎兵器库': '—', '明昀日常堂': '○偶尔', '门口巨石': '○偶尔', '林间廊桥': '◎频繁', '门主室议事': '—', '寝居': '○偶尔' }, schedule: '日常劳作与基础修炼', personality: '普通外门弟子' }
            ]
        }
    ],

    // 地点数据
    locations: [
        {
            name: '衢府',
            slug: 'qufu',
            location_type: 'sect',
            region: '蓬莱仙岛',
            description: '仙门最高管辖机构，统管所有门派，等级森严，乾令制度森严。',
            ruler: '衢府府主',
            access_rule: '持乾令者方可进入，大比期间临时开放。',
            atmosphere: '威严庄重，仙气缭绕，规矩严明。',
            visual_note: '建筑群依山而建，气势恢宏，乾令碑立于正门。',
            danger_level: 2
        },
        {
            name: '诛仙台',
            slug: 'zhuxiantai',
            location_type: 'platform',
            region: '蓬莱仙岛',
            description: '衢府入口守卫之地，乾令查验之处，气势威严。',
            ruler: '衢府守卫',
            access_rule: '需持有效乾令方可通过。',
            atmosphere: '肃杀威严，乾令气息弥漫。',
            visual_note: '高台耸立，乾令碑立于中央，守卫森严。'
        }
    ],

    // 物品数据
    items: [
        { id: 1, name: '培元丹', type: '丹药', description: '基础丹药，可恢复少量灵力', effect: '恢复50点气血' },
        { id: 2, name: '青锋剑', type: '武器', description: '基础剑器', effect: '攻击力+10' }
    ],

    // 随机NPC出现规则
    randomNpcRules: {
        description: '各门派存在大量随机生成的弟子NPC，其出现位置依以下规则决定',
        rules: [
            {
                npcType: '外门弟子（各门派）',
                spawnRule: '在门派公共区域（药圃/廊道/演武场/旃林场）随机生成',
                density: { day: '高', night: '稀少' },
                note: '白日密度高，夜间稀少'
            },
            {
                npcType: '内门弟子（各门派）',
                spawnRule: '在本堂/本峰/专属修炼区活动',
                density: { day: '中等', night: '仅留寝居或修炼' },
                note: '夜间仅留寝居或修炼'
            },
            {
                npcType: '中草堂丹师（沁雨阁）',
                spawnRule: '主要在晴岚室与丹鼎台附近随机生成',
                note: '代表历练回阁的驻堂弟子'
            },
            {
                npcType: '内门弟子（溟安门）×3',
                spawnRule: '分属兆元、平黎、明昀三长老',
                note: '各在其长老负责区域附近活动'
            },
            {
                npcType: '内门弟子（祢听观）×4',
                spawnRule: '分属玉安、玉骋、长乐、明玉四位',
                note: '主要在教习室与庭院出现'
            }
        ],
        timeRules: {
            dawn: { time: '02:00–06:00', rule: '全门派弟子均回寝居，仅门主/观主/太上长老级别可在特定地点' }
        },
        specialRules: {
            fullMoon: { location: '西刹两派（沁雨阁/溟安门）', rule: '满月之夜部分弟子会至迷雾散去的林间廊桥/门口聚集' }
        }
    },

    // 各门派场所编号速查
    locationIndex: {
        沁雨阁: ['①长廊药圃', '②百草苑', '③晴岚室', '④九乘丹鼎台', '⑤幽蛊窟', '⑥素华台', '⑦正殿议事', '⑧寝居后院'],
        御桓派: ['①云缈修炼场', '②醉落观景台', '③冰阁藏书阁', '④烟浅炉台', '⑤景惜演武场', '⑥峰间铁索桥', '⑦门主殿议事', '⑧寝居'],
        溟安门: ['①旃林场', '②百兽廊', '③平黎兵器库', '④明昀日常堂', '⑤入口门口', '⑥林间廊桥', '⑦门主室议事', '⑧寝居'],
        祢听观: ['①天机殿', '②霜阁', '③占星楼', '④玉安教习室', '⑤观门白泽', '⑥庭院廊道', '⑦接引外务室', '⑧寝居']
    },

    // 职位数据
    positions: {
        '祢听观': [
            { name: '观主', sect_id: 4, level: '高位', description: '现任观主，司命之徒，卜策一道登峰造极，但不管事', responsibilities: '名义上统领祢听观，传授卜策要义，重大事务仍需其点头', permissions: '可任命长老，决定观中大事，但日常事务一概不管', promotion_conditions: '前任指定或门内推选', max_count: 1 },
            { name: '玉安长老', sect_id: 4, level: '高位', description: '观主师妹，生性内敛，教习占卜之术，实际管事者', responsibilities: '实际管理祢听观日常事务，教导普通弟子占卜之术，守护观中传承', permissions: '可管理日常事务，指导弟子学习，推荐优秀弟子，决定教学内容', promotion_conditions: '观主任命，需精通卜策', max_count: 1 },
            { name: '玉骋长老', sect_id: 4, level: '高位', description: '观主师弟，性情暴躁，路见不平', responsibilities: '在外维护观中声誉，处理棘手事务，必要时出手相助', permissions: '可代表观中处理外部事务，自由出入', promotion_conditions: '观主任命，需有担当', max_count: 1 },
            { name: '长乐君', sect_id: 4, level: '中位', description: '豁达大度，性情洒脱，遇正则严，可收徒', responsibilities: '负责观中接引，处理往来事务，管理日常运营，遇大事严苛，可教导弟子', permissions: '可管理日常事务，接引访客，处理常规问题，收徒传艺', promotion_conditions: '观主任命，需处事灵活', max_count: 1 },
            { name: '明玉阁主', sect_id: 4, level: '中位', description: '清心寡欲，对弟子严厉，护短，可收徒', responsibilities: '管理明玉阁事务，教导弟子，维护阁中秩序，可收徒传艺', permissions: '可管理阁内事务，对亲近之人无条件护短，收徒传艺', promotion_conditions: '观主任命，需品行端正', max_count: 1 },
            { name: '大师兄', sect_id: 4, level: '中位', description: '玉安长老亲传弟子，最了解观主', responsibilities: '跟随师父玉安长老修行，协助处理观中事务，代表弟子发言', permissions: '可参与部分决策，优先接取高级任务', promotion_conditions: '玉安长老亲传，需深得信任', max_count: 1 },
            { name: '亲传弟子', sect_id: 4, level: '低位', description: '各师父亲传弟子，得真传', responsibilities: '跟随各自师父修行，钻研卜策之术，代表弟子参与观中事务', permissions: '可使用核心资源，优先接取任务', promotion_conditions: '各师父亲自收徒，需资质出众', max_count: 10 },
            { name: '内门弟子', sect_id: 4, level: '低位', description: '正式弟子，随各师长修行', responsibilities: '日常修炼，学习卜策之术，完成观中任务', permissions: '可使用内门资源，接取任务，参加衢府大比', promotion_conditions: '外门晋升或特招', max_count: 20 },
            { name: '外门弟子', sect_id: 4, level: '低位', description: '预备弟子，考察期', responsibilities: '完成杂务，修炼基础，接受考察', permissions: '可接取基础任务，使用基础资源', promotion_conditions: '通过入门测试', max_count: 99 }
        ]
    },

    // NPC完整数据（来自数据库）
    npcs: [
        // ==================== 沁雨阁 NPC ====================
        {
            id: 6,
            name: '苏凝霜',
            zi: '芸卿',
            title: '阁主',
            level: '高位',
            gender: '女',
            personality: '温柔仁厚，待人如春风化雨，鲜少疾言厉色。对弟子视如子女，对患者无论贫贱皆一视同仁。然仁厚之下自有主见，处事周全不失决断，笑意盈盈间已将全局握于掌心。偶有顽皮之态。',
            appearance: '发色乌黑，质地柔顺，绾于顶后，以碧玉簪贯之，簪身素净，无繁饰。几缕细发散落于耳侧，自然垂下，未加约束。眉形柔和，弧度舒缓，眉色不深。眼型适中，眼尾微弯，眼珠色泽清润。鼻梁挺而柔，线条无棱角。唇形圆润，唇角微微上扬，似笑非笑，常驻于面，未曾敛去。肤色白皙匀净，面部轮廓圆柔，年岁不显，望之如二十出头。着淡青色广袖长裙，衣料轻软，领口平整，袖身宽阔，袖口自然垂落。裙身于领口、袖口及裙摆处绣有百草纹，草叶纹样疏密有致，针脚细密，纹路舒展。外搭同色系薄纱披帛，绕肩垂落，质地轻透。腰间以素色腰封系结，腰封边缘压有细浅暗纹，腰侧缀一枚碧玉圆佩，佩身温润，以细绳系就。足蹬淡青色绣鞋，鞋面绣有细小草叶纹。眉眼生得温柔，五官无一处见锋，面容如常含笑，笑意浅淡，不张不敛，常驻于唇角眉梢之间。周身气息温而静，近之令人自觉松弛。然笑意之后，眉眼之间另有一分沉稳清明压于其下，不外露，不张扬，惟细观方察其深。',
            biography: '出身寒微，幼时家乡疫病横行，父母皆亡于时疫，自此立志习医救人。机缘之下得沁雨阁前任阁主收入门下，天资卓绝，于药、毒、丹三系皆有极深造诣。曾孤身入绝境瘴地采集百年毒草，历经生死而归，声名大噪。后于衢府大比中摘得魁首，被前任阁主钦定为传人，继任阁主之位至今，将沁雨阁中草堂之业扩至四国各地。',
            power_level: 2900,
            speciality: '医术、炼丹、用毒，三者皆臻化境。尤擅以毒入药、以药解毒，世间奇毒罕有她不识者。另精通药阵布置，可借地利以草木之力御敌。',
            relationship: '副阁主——师姐，自幼同门，情同手足，信任有加；太上长老——师叔，多有仰仗，私下颇为亲近；少阁主——侄女与徒弟，亦师亦友，关爱有加',
            notes: '待弟子如慈母，对患者无论贫贱皆一视同仁。爱以各类奇药试人，美其名曰调理体质；以木系灵力为根基，擅以百草之力入阵，能于方圆之内催生藤蔓草木困缚敌身。精通药毒之道，战时惯用无色无味之毒雾配合丹药，令敌防不胜防。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 7,
            name: '谢冽霜',
            zi: '寒璋',
            title: '副阁主',
            level: '高位',
            gender: '女',
            personality: '冷静自持，不苟言笑，处事雷厉风行。于弟子要求严苛，眼中揉不得半粒沙子，赏罚分明。实则心思细腻，对门派之事尽心尽力，只是惯以冷面示人，鲜少吐露情绪。',
            appearance: '发色乌黑，束高髻，以银质发冠固定，髻形规整，无散发垂落，一丝不苟。眉峰微锋，眉形利落，眉色浓黑。眼型狭长，眼尾微挑，眼珠色深。鼻梁高挺，线条峻直。唇形薄而分明，唇角平收，惯常抿闭。肤色白皙，面部轮廓清隽，骨相偏硬，棱角可见。身姿修长，脊背挺直。着银白色广袖长袍，衣料垂感沉稳，领口平整，袖身宽阔，衣摆及地。领口与袖口绣有细密银色云纹，纹样内敛，走线均匀。腰间悬一枚银针囊，针囊形制小巧，以细带系于腰侧，囊面绣有极细的针纹，针脚精密。腰封以同色布料束就，平整无褶，腰封正中缀一枚银质长扣。足蹬白色长靴，靴筒及膝，靴面素净。五官生得清冷，轮廓分明，无一处松散。周身气息寒而肃，自成一段凛然，不怒而威，近之令人不自觉收敛举止。',
            biography: '与阁主同门，入门更早，曾被视为下任阁主的不二人选。性格刚直，曾因当众驳斥前任阁主决策而受罚，却也因此得前任阁主另眼相看。大比中以针灸之术技惊四座，位列前三。后主动请缨接掌中草堂事务，将各地中草堂经营得井井有条，实为沁雨阁对外的中流砥柱。对于未能继任阁主一事从无芥蒂，与阁主配合默契。',
            power_level: 2800,
            speciality: '针灸之术天下一绝，既可治病救人，亦可封穴制敌。另精于中草堂经营管理，对各地药材市场了如指掌，是沁雨阁对外交涉的主要负责人。',
            relationship: '阁主——师妹，情同手足，是最信任之人；太上长老——同辈师叔，相互敬重，往来有度；弟子蝴蝶兰——亲传弟子，严格要求，实则寄予厚望。',
            notes: '与阁主相处时偶有难得的松动，是极少数能见她失态的场合；以银针为兵器，出手迅如闪电，可于瞬息间封锁敌方经脉穴位，令其动弹不得。针法配合木系灵力，能令银针化作千道寒芒齐射。针芒可破护体灵力，被江湖称作"银针判官"绝非虚名。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 8,
            name: '叶承煦',
            zi: '怀安',
            title: '太上长老',
            level: '高位',
            gender: '男',
            personality: '温润儒雅，言谈举止间自带一股书卷气。待人谦和有礼，从不倚老卖老，对晚辈多有提携鼓励。实则阅历深厚，看人极准，偶尔语带机锋，令人回味良久。对晚辈有耐心，偶尔语带机锋，但点到为止，不深追。私下有自己的趣味和执念。',
            appearance: '发色灰白各半，黑白相间，以素色发带松松束于脑后，束法随意，几缕发丝自然垂落于面侧与颈间，未加约束。眉形舒展，弧度平缓，眉色已淡。眼型适中，眼尾略带纹路，眼珠色深。唇角微微上扬，浅笑常驻，未曾敛去。面部轮廓柔和，岁月纹路隐于眉眼之间，望之约莫四十许，不显更深年岁。着月白色广袖长袍，衣料垂顺，袖身宽松，领口与袖口绣有火纹，纹样舒展流动，线条圆润，绣工细密。腰间以深色宽带系结，带结偏于一侧，随意不拘。腰侧挂一枚旧玉佩，玉色略显陈旧，边缘有岁月留下的细小磨痕，以旧绳系就。外搭同色系薄披，披身及腰，边缘无饰。足蹬布面长履，履色月白，履面素净。身侧隐有焚香与丹药气息，淡而不散。眉眼生得温和，五官无一处见棱角，面容常含浅笑，笑意不深不浅，自然而驻。周身气息暖而沉，近之令人不自觉松弛戒备。然眉眼深处另有一分清明透彻压于其下，不张扬，不外露，言语之间偶有锋芒一闪，转瞬又归于温润，令人回味。',
            biography: '沁雨阁资历最深的长老，曾为前前任阁主的师弟。年轻时游历四方，见识极广，曾只身闯入上古火灵脉窃取天火种，以此悟通控火之术，将天火引入沁雨阁灵脉，自此与九乘丹鼎结缘。大比曾连续两届摘冠，战绩赫赫。后自愿卸去阁主之位的角逐，专心镇守丹鼎与灵脉，至今已逾数百年。对阁主、副阁主皆有提携之恩，是沁雨阁真正的定海神针。',
            power_level: 3000,
            speciality: '控火之术登峰造极，尤擅以天火炼丹，所出丹药品阶远超常人。另精通丹道理论，九乘丹鼎的全部奥义唯他一人尽数掌握。闲暇时亦通晓卜策之术，偶为门派决策提供参谋。',
            relationship: '阁主——师侄辈，视若子侄，暗中多有护持；副阁主——同上，严中有爱；前任阁主——师兄，已飞升，常忆及；木德真君——曾得真君托梦指引，与真君有一段渊源。',
            notes: '以天火入道，控火之术精妙绝伦，可驭天火化作万千形态，攻守皆宜。木克火，然他以天火反制木系之法独步一时，令同门弟子叹为观止。轻易不出手，一旦动真格，方圆百里皆感其威。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 9,
            name: '苏微澜',
            zi: '听雨',
            title: '少阁主',
            level: '中位',
            gender: '女',
            personality: '外表清冷淡然，实则心思细腻温柔。处事沉稳早慧，言行举止间已有几分超出年岁的稳重。不善主动亲近人，给人距离感，然并非冷漠，只是不习惯先开口。不善主动亲近他人，给人距离感，然一旦认定之人便会以全部真心相待。承载旁人的期望与压力，从不在外人面前示弱，偶尔独处时才会卸下重担发发呆。',
            appearance: '发色墨黑，束单髻于顶，髻形规整，以一支碧玉流苏发簪固定，簪身碧色，流苏细长，随动轻曳。无散发垂落，发线整齐。眉形舒展，弧度柔和，眉峰不显，眉色乌黑。眼型适中，眼尾微弯，眼珠色深，清澈而有深度。鼻梁挺而柔，线条圆润。唇形匀称，唇色淡粉，唇角自然平收，不扬不敛。肤色白皙，质地细腻，面部轮廓柔和，骨相清隽，棱角不显。着青白色广袖长裙，衣料轻软垂顺，领口平整，袖身宽阔，袖口自然垂落。裙身素净，领口处绣有细密青色水纹，裙摆处绣有细密雨纹，纹样纤细，针脚均匀，雨丝纹路疏密有致。腰间以淡青色腰封系结，腰封平整，正中缀一枚白玉方佩，佩面素净。外搭青白色薄纱披帛，绕肩垂落，质地轻薄。足蹬青色绣鞋，鞋面绣有细小雨丝纹。容貌生得清丽，五官各处停匀，静立时如画。眉眼之间有几分温柔，与阁主眉目隐有相似之处，然其间另压一分沉静内敛，使那温柔多了几分深度。周身气息清而静，自带一段距离，近之不觉压迫，却令人不自觉收敛，不敢轻易靠近。',
            biography: '乃阁主苏凝霜之侄女，自幼随姑母在沁雨阁长大，耳濡目染之下对医术、丹道、药理皆有涉猎。天资极高，悟性更胜一筹，然她并不满足于门派庇护之下的顺遂，年岁尚轻便主动请缨出阁游历，独自行走四方积累阅历，回阁后修为与眼界皆有脱胎换骨之变。后代表沁雨阁参加衢府大比，以医术、炼丹双项联手夺魁，成为近百年来最年轻的大比优胜者，由此被阁主正式内定为少阁主，继承人之位昭告门内。与彼岸花、风信子、蝴蝶兰同辈相识于大比之前，四人私交甚笃。',
            power_level: 2200,
            speciality: '医术全面而精深，尤擅诊脉断症，据说可于把脉三息内判断对方灵脉根骨与隐患。炼丹造诣亦不俗，对复方高阶丹药有独到见解。另有极强的全局统筹能力，处变不惊，已展现出未来阁主的气度与格局。',
            relationship: '阁主苏凝霜——姑母兼师父，最亲近之人，表面恭敬实则私下极为依赖；副阁主——严师，最令她敬畏之人，被严格要求从无怨言；太上长老——师叔祖，偶尔找他讨教，是阁中最让她感到安心的长辈；彼岸花——同辈挚友，二人性格迥异却莫名投缘，常被他带着做些出格之事；风信子——同辈挚友，最爱与她分享炼丹心得，是她私下最放松的相处对象之一；蝴蝶兰——同辈挚友，彼此心有灵犀，无需多言便能互相理解。',
            notes: '与彼岸花、风信子、蝴蝶兰相处时会露出与平日截然不同的小女儿态。苏凝霜之侄女。以木系灵力为根基，自创一套将医术与攻伐融为一体的战法——以感知敌方经脉气血为前提，精准打击对方灵力运转的薄弱节点，四两拨千斤。另擅以药阵布局战场，于阵中如鱼得水。大比武试中以此战法令诸多修为高于她的对手折戟，令观者叹为观止。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 10,
            name: '苏朝',
            zi: '明远',
            title: '朝晖长老',
            level: '中位',
            gender: '女',
            personality: '温暖开朗，笑声爽朗，是阁中人缘最好的长老。对药材有近乎痴迷的热爱，见着珍稀草药眼睛便会发光。待弟子随和亲切，却在药材培育之事上极为认真严格，容不得半点马虎。',
            appearance: '发色棕褐，松松挽作低髻，髻形随意，以应季鲜花簪于髻侧，花朵随时令更换。面容圆润，轮廓柔和，颧骨不显。眉形自然舒展，弧度圆缓，眉色适中。眼型圆润，眼尾有细纹浅浅，笑时纹路显现。鼻梁适中，鼻尖圆润。唇形饱满，唇角自然上扬，笑意常驻。肤色温润，带有常年日晒后的健康色泽。着嫩绿色襦裙，内衬月白色交领短襦，领口平整，袖口收束。外着嫩绿色及膝褙子，褙子边缘压有细浅草叶暗纹。下着同色长裙，裙摆处绣有简化草叶纹，针脚细密。衣摆处有泥土与草汁留下的痕迹，深浅不一，散落无规律。腰间以布带随意系结，腰侧挂一枚小巧竹制药筒，筒身素净，以细绳系就。手上常戴护甲手套，手套贴合手形，指尖护甲以竹片制成。足蹬布面便履，履面沾有细碎草屑。眉眼生得圆润可亲，五官无一处见棱角，笑意似常驻于面，眼尾细纹随笑意深浅隐现。周身气息暖而近，草木清甜之气混杂萦身，令人不自觉松弛。',
            biography: '自幼对草木有异于常人的亲和力，灵力与植物相互感应，入沁雨阁后如鱼得水。专心深耕药材培育数十年，将药堂的珍稀药材品种扩充了数倍，其中不乏数株濒临灭绝的上古灵药由她亲手复育成功。大比中以药材培育与药理知识一骑绝尘，被誉为沁雨阁药堂史上最出色的堂主。与夕颜长老相识于同门修行时期，二人情意相投，多年相伴至今。',
            power_level: 2300,
            speciality: '药材培育首屈一指，尤擅复育濒危灵药与改良药材品质。对草木生长规律了如指掌，可以灵力感知方圆内所有植物的状态。另通晓基础药理，与繁缕长老合作研毒时常提供珍稀原材料。',
            relationship: '夕颜长老——爱侣，相伴数十年，互为依靠；阁主——上司亦是好友，私下常被阁主拉去试药；太上长老——敬重有加，时常为丹鼎提供顶级药材；繁缕长老——药材供应合作关系，私下也算投缘。',
            notes: '非攻伐型修士。战时以木系灵力催动药草疯狂生长形成天然屏障，辅以催眠、致幻类药雾拖延敌势。不擅长正面交锋，然于药堂地界之内借地利几乎无解。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 11,
            name: '裴晚吟',
            zi: '素吟',
            title: '夕颜长老',
            level: '中位',
            gender: '女',
            personality: '端庄沉静，说话轻声细语却字字有分量。对弟子教导极有耐心，循循善诱，是阁中弟子最敬爱的师长之一。私下里有些傲娇，面对朝晖长老时明明心软却总爱绷着脸，往往被对方三两句话哄得妥协。对不用心的弟子会给予严厉的眼神，胜过千言万语。',
            appearance: '发色乌黑，束高髻，以玉兰纹发钗固定，髻形规整，无散发垂落。眉形如画，弧度清隽，眉峰略显，眉色浓黑。眼型修长，眼尾平收，眼珠色深。鼻梁高挺，线条利落。唇形匀称，唇色淡，唇角平收，惯常抿闭，不轻易开口。肤色白皙，面部轮廓清隽，骨相柔中带硬。手指修长，指节分明，常执书卷。着素白广袖长袍，衣料垂顺，领口与袖口绣以细密玉兰纹，花瓣纹样舒展，针脚均匀，清雅不繁复。袖身宽阔，衣摆及地。腰间以白色腰封束就，腰封正中嵌一枚白玉长条佩，佩面雕有浅细玉兰纹。腰侧以细绳挂一支白玉书签，书签素净，边缘无饰。外搭同色薄纱披帛，绕肩垂落。足蹬白色绣鞋，鞋面绣有玉兰花瓣纹。眉眼生得秀丽清冷，五官如画，静立时如月下玉兰，近而不可亵。周身气息沉而静，自带端庄，令人不自觉敛声屏气。眉眼之间压着一分矜持，不张扬，不松动，然细观眉梢，偶有一分未尽敛去的柔软隐于其中。',
            biography: '出身书香世家，自幼饱读诗书，入沁雨阁后将所学与修仙之道融会贯通，形成了一套独特的教学体系。掌教堂多年，门下弟子遍布沁雨阁各堂，数位长老皆出其门下。大比以卜策与药理双项名列前茅。与朝晖长老相识相知，彼此相守至今，是阁中人人艳羡的一对。',
            power_level: 2250,
            speciality: '教学育人为第一专长，对弟子资质与性格的判断极准，善于因材施教。另精通卜策，为阁中决策提供参谋。文献典籍涉猎极广，沁雨阁历代记录皆由教堂整理存档。',
            relationship: '朝晖长老——爱侣，相伴数十年，对其溺爱又嘴硬；阁主——上司，敬重信任；副阁主——同期共事多年，互相欣赏；弟子蝴蝶兰——曾为其启蒙师长，后转入副阁主门下，仍时有关怀。',
            notes: '以木系灵力凝练出独特的"经络封印术"，可于交谈间不动声色地以灵力探查对方经脉弱点，战时精准打击。另擅以卜策之术预判敌方走势，配合朝晖长老的困阵使用效果极佳。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 12,
            name: '顾寒璋',
            zi: '执白',
            title: '濯玉长老',
            level: '中位',
            gender: '男',
            personality: '冷峻刚直，执法严明，六亲不认。沉默寡言，非必要不多开口，然一旦开口必是要紧之事。内心实则有一套极为清晰的是非标准，对弱者暗有怜悯，只是从不形于色。阁中弟子对他又敬又怕，背地里称他"阎王爷"，他知晓却从不在意。',
            appearance: '发色纯黑，束高髻，以黑色发冠固定，髻形规整，无散发垂落，一丝不苟。眉形剑挺，入鬓，眉色浓黑，眉峰锋利。眼型狭长，眼尾微挑，眼珠色深，目光如刃。鼻梁高峻，线条硬直。唇形薄而分明，唇角平收，惯常抿闭。面部轮廓硬朗，骨相分明，棱角可见，本算俊朗，然长年神情冷肃，五官之利尽数压于其上，令人难以细看。身形高挑，脊背挺直。着玄色广袖长袍，衣料厚实，垂感沉稳，领口平整，袖身宽阔，衣摆及地。领口与袖口压有极细的暗色回纹，纹样内敛，近看方辨。腰间悬一枚刑堂令牌，令牌以细链系于腰侧，牌面素净，随行不动。腰封以同色革带束就，革带宽厚，扣环铁制，素净无饰。足蹬黑色长靴，靴筒及膝，靴面平整。眉眼生得硬朗，五官棱角分明，周身气息冷而肃，凛然压人，近之令人不自觉后退半步。然眉眼深处另有一分沉色压于其下，不外露，不言说，藏于一贯的冷面之后，不细观不易察觉。',
            biography: '早年曾是游历四方的散修，亲历过门派倾轧与江湖黑暗，深知规矩对于一个门派的重要性。后受阁主招揽入沁雨阁，凭借过硬的实力与铁面无私的行事风格接掌刑堂。任刑堂之主以来，阁规从未被人钻过空子，威慑力极强。大比中以武试名列前茅。私下与太上长老有数面之缘，对其颇为敬重。',
            power_level: 2500,
            speciality: '武力为阁中中层之冠，执法断案精准果决。另对人心揣摩极准，审讯时往往不费多少力气便能令人如实相告。对阁规条文倒背如流，无人能在他面前钻空子。',
            relationship: '阁主——上司，忠心效命，偶有异议也会直言；副阁主——相互敬重，行事风格颇为相近；繁缕长老——面上不对付，实则互相欣赏，私下偶有来往；弟子彼岸花——曾短暂指导过其武学，算是半个师长。',
            notes: '以木系灵力凝练出坚不可摧的护体罡气，攻守兼备。惯使一柄玄铁长剑，剑法凌厉刚猛，与沁雨阁柔和的风格截然不同。正面交锋时鲜有败绩。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 13,
            name: '林幽蔓',
            zi: '蔓卿',
            title: '繁缕长老',
            level: '中位',
            gender: '女',
            personality: '神秘莫测，笑意盈盈却令人捉摸不透。说话云山雾罩，爱卖关子，喜欢观察他人的反应。对毒学有近乎疯狂的执迷，研毒时会进入一种旁若无人的专注状态。表面随和好说话，实则心思极深，从不轻易让人看透底牌。待自己弟子倒是出奇地坦诚，是阁中风格最为独特的长老。',
            appearance: '发色深紫近黑，散落肩头，以一支骨簪半挽，簪身雕有毒蛊纹，纹路细密，线条繁复，余发自然垂落。眉形细而微挑，弧度流转，眉色与发色相近，近于深紫。眼型狭长，眼尾上挑，眼珠色深，眼皮略带慵意。鼻梁挺而秀，线条柔中带利。唇形饱满，唇色深红，唇角微微上扬，笑意常驻。面部轮廓柔而有致，艳色天成。指尖戴镶宝石护甲，宝石色深，护甲线条纤细，贴合指形。着深紫色轻薄广袖长裙，衣料半透，垂感流动，领口饰以繁缕花纹，纹样层叠，线条蜿蜒。腰间以细银链束腰，银链双股交缠，链上缀数枚小巧毒蛊纹银坠，坠身细小，随行轻响。裙身随行轻曳，衣摆飘动。外搭同色系薄纱披帛，披帛边缘绣有极细蛊纹，纹路繁密。足蹬深紫色绣鞋，鞋面绣有蔓藤花纹。容貌生得艳丽，五官流转，自有一股勾人气韵，近之令人不自觉多看。眉眼之间笑意似有似无，常驻而不深，令人难以分辨真假。',
            biography: '出身成谜，入沁雨阁前的经历从未向人提及。以一手令人叹为观止的制毒之术叩开沁雨阁大门，此后在毒堂一待便是数百年。所研之毒涵盖奇、猛、隐、缓各类，其中数种已被列入各国禁典。对阁主忠心耿耿，原因不详，只说欠了一个人情。大比中以炼丹与武试双项参赛，皆有不俗成绩。',
            power_level: 2400,
            speciality: '制毒用毒为天下一绝，对毒理的研究已自成体系。另精通以毒入药的特殊炼丹之法，所出丹药药效奇特，非寻常炼丹师能复制。对各类毒物的气味极为敏锐，几乎无毒可逃过她的感知。',
            relationship: '阁主——欠有人情，忠心辅佐，私下关系颇为亲近；濯玉长老——表面互怼，实则互相欣赏；朝晖长老——药材合作伙伴，私交不错；弟子彼岸花——倾囊相授，视为衣钵传人。',
            notes: '据说护甲内暗藏剧毒；战斗风格阴柔难测。以毒雾、毒粉配合木系灵力广域扩散，令敌难以防范。近战时护甲上的剧毒亦是利器。最令人忌惮之处在于，她的毒素往往在交手结束后许久才发作，令人防不胜防。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 14,
            name: '方晏清',
            zi: '明炉',
            title: '泽曦长老',
            level: '中位',
            gender: '男',
            personality: '温和专注，话不多但极为踏实可靠。对炼丹之事有一种近乎虔诚的认真，丹炉前可以一连守候七七四十九天而神色不变。不善言辞，与人交谈时偶有词不达意的窘态，却总能以行动弥补。对弟子极有耐心，失败了从不责骂，只是默默陪着再来一遍。是阁中最让人觉得安心的存在之一。',
            appearance: '发色棕黑，以素色发带束成低马尾，发带系法简单，几缕发丝散落于面侧与颈间，未加约束。眉形舒展，弧度平缓，眉色适中。眼型适中，眼珠色泽温润。鼻梁挺而平实，线条无棱角。唇形匀称，唇角自然，不扬不敛。面部轮廓柔和，清俊而不见锋芒。手掌宽厚，指节粗糙，掌面有长期接触丹火留下的细小纹路。着赭色宽袖长袍，衣料厚实，领口平整，袖身宽松。领口处压有极浅的云纹暗线，纹样简朴。袖口与前襟处有细小烧灼痕迹，深浅不一，散落无规律，是长年守炉所留。腰间以素色宽布带系结，带结居中，松紧适中。腰侧挂一枚旧铜药盒，盒身有岁月留下的细小磨痕，以粗绳系就。衣摆及地，行步间不见轻曳，沉稳贴身。足蹬布面长履，履色深赭，履面素净。眉眼生得温和舒朗，五官无一处见锋，面容平实，近之令人自觉安稳。周身气息厚而静，不张扬，不疏离，如其人，踏实而无声，然自有一分令人心安的重量压于其中。',
            biography: '出身普通，天资并不算顶尖，全凭一股钻研到底的韧劲在炼丹一道上走出了自己的路。曾连续三年闭关只为攻克一枚高阶丹药的配方，出关时所炼丹药直接被太上长老评为近百年来最佳。大比以炼丹一项夺得魁首，是当之无愧的丹道专才。与太上长老亦师亦友，受其指点良多。现掌丹堂，将丹堂出品的丹药质量提升至历代最高水准。',
            power_level: 2350,
            speciality: '炼丹造诣极深，尤擅高阶复方丹药的研制，对火候掌控的精准度在阁中仅次于太上长老。另对丹药配方的记忆力惊人，历代百草药典中的丹方皆能默写如流。与太上长老合作时可将九乘丹鼎的效能发挥至极致。',
            relationship: '太上长老——亦师亦友，受益良多，极为敬重；阁主——上司，敬重信任，时常为阁主提供定制丹药；弟子风信子——下任丹堂主候选，悉心培养，寄予厚望；泽曦长老与濯玉长老——同为阁中话少之人，偶尔并肩沉默喝茶，默契十足。',
            notes: '以丹药入战，随身携带各类功效丹药，可于战时迅速应对各种突发状况。以木系灵力配合丹火形成防御结界，久攻不破。正面战力并非所长，然持久战中因丹药补给充足几乎立于不败之地。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 15,
            name: '殷冥棠',
            zi: '幽渡',
            title: '彼岸花',
            level: '低位',
            gender: '男',
            personality: '慵懒散漫，说话带着三分漫不经心，却在用毒一事上判若两人，精准狠辣。对外界之事兴致寥寥，唯独对新奇毒物有强烈的探知欲。表面吊儿郎当，实则心思缜密，极少将真实情绪示于人前。',
            appearance: '发色赤黑，半披半束，以一支彼岸花骨簪随意别起，簪身雕有彼岸花纹，余发散落肩头，未加约束。眉形细而微挑，眉色深。眼型狭长，眼尾上挑，眼珠色深，眼皮微垂。鼻梁挺秀，线条柔利。唇形饱满，唇色深，唇角微微下压，带着漫不经心。肤色白皙，指尖因长年接触毒物色泽略显苍白，与手掌肤色深浅有别。着暗红色广袖长衫，衣料轻薄，领口微敞，领口边缘绣有极细彼岸花纹，纹样蜿蜒，线条流动。衣身垂落随意，不见束整。袖身宽阔，袖口自然垂落，袖缘压有深色暗纹。腰间以暗红色细带随意系结，带结偏垂，腰侧挂一枚兽骨小坠，坠身雕有细小蛊纹，以细皮绳系就。衣摆随行轻曳，不见规整。足蹬黑色软底履，履面素净。容貌生得清冷妖艳，五官各处皆有摄人之色，然神情慵懒，眼皮微垂，将那艳色压去几分，反添一股漫不经心的危险。',
            biography: '出身不明，幼时以孤儿身份流落至沁雨阁附近的中草堂，因误食数种剧毒野果却安然无恙，引起繁缕长老注意，由此被带入门内。天生对毒素有异于常人的耐受与亲和，入门后被繁缕长老收为亲传弟子，倾囊相授。年纪轻轻便研制出数种新型复合毒素，令繁缕长老刮目相看。曾代表沁雨阁参与衢府大比，于武试中以毒术令对手措手不及，一鸣惊人。',
            power_level: 2000,
            speciality: '毒术天赋冠绝同辈，对毒素的调配与释放已达到随心所欲的境界。另对毒物的气味感知极为敏锐，几乎与繁缕长老不相上下。武学上受濯玉长老短暂指点，近身搏击亦有一手。',
            relationship: '繁缕长老——师父，最信任之人，师徒情深；濯玉长老——半个武学师父，敬而畏之；风信子——挚友，日常斗嘴，实则互相托付性命；蝴蝶兰——挚友，三人中最沉稳的一个，彼岸花私下最依赖她；阁主——上级，偶尔被拉去试药，苦不堪言。',
            notes: '与风信子、蝴蝶兰相处时偶有难得的放松，三人之间斗嘴是日常，感情却极深。以毒为核心战术，可将毒素凝练于灵力之中隐匿释放，令敌人在不知不觉间中毒。近战以浸毒匕首为兵器，出手快准狠。因天生毒体，对他人施放的毒素几乎免疫，是克制毒系敌人的天然克星。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 16,
            name: '祁朗舟',
            zi: '行云',
            title: '风信子',
            level: '低位',
            gender: '男',
            personality: '开朗话多，精力充沛。嘴上没个把门，常说漏嘴又死不承认，爱面子。对炼丹有极强的胜负欲，听不得别人说他的丹药不好，被激将法一激便会加倍努力去证明自己。心地良善，对弟子同门极为仗义，出事时第一个冲在前面。',
            appearance: '发色棕黄，束成马尾，束法随意，发梢微卷，几缕碎发散落于额前与耳侧，未加约束。眉形舒展，眉峰不显，眉色适中。眼型圆润，眼尾平收，眼珠色泽明亮。鼻梁适中，鼻尖略圆。唇形饱满，唇角自然上扬。面部轮廓圆润，骨相不显，俊朗而亲近。手背有几处浅淡烧灼旧疤，疤色浅，边缘平整。着明蓝色短打劲装，衣料贴合，领口规整，衣身利落，方便行动。领口与袖口压有细浅水纹暗线，纹样简洁。衣袖挽至手肘，袖口随意折叠，不加约束。腰间以深色宽布带束腰，带扣铜制，扣面素净。腰侧挂一枚小铜炉坠，炉身微型，铸工细密，以粗铜链系就，随行轻晃。足蹬深蓝色短靴，靴面平整，靴底厚实。眉眼生得开朗，五官舒朗，笑时眼尾弯起，眼睛眯成月牙形，笑意漫至眉梢。周身气息明快跃动，近之令人不自觉跟着松快。身侧有丹药与烟火气混杂萦绕，气息浓淡相间，不散。',
            biography: '出身丹药世家，自幼耳濡目染，对炼丹有天然的悟性。家中原属一方小势力，后家道中落，以优异的炼丹天赋叩开沁雨阁大门，被泽曦长老亲自收入门下。入阁后进步神速，屡次突破炼丹瓶颈，已被定为下任丹堂主候选。大比中以炼丹一项成绩斐然，与彼岸花、蝴蝶兰并列为当代沁雨阁最出色的弟子。心中立志超越师父泽曦长老，更要在太上长老面前炼出令其点头称赞的丹药。',
            power_level: 1900,
            speciality: '炼丹天赋极高，对火候与配方的把握已有独到心得，尤擅速成丹与爆破类攻击性丹药的研制。记忆力极佳，丹方过目不忘。另嘴皮子功夫一流，是三人中最擅长与外人周旋交涉的一个。',
            relationship: '泽曦长老——师父，最敬仰之人，立志超越又深知相差甚远；太上长老——心中终极目标，每次被夸一句便高兴数日；彼岸花——挚友，互相斗嘴是日常，危急时刻最可靠；蝴蝶兰——挚友，最爱找她倾诉烦恼，对方永远耐心倾听。',
            notes: '以随身携带的各类丹药作为主要战斗手段，攻击性丹药爆破、防御性丹药结盾，战术灵活多变。灵力本身偏向木系中的生机之力，近战能力一般，然丹药储备极为充足，消耗战中极难被击溃。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        {
            id: 17,
            name: '温瑶枝',
            zi: '静徽',
            title: '蝴蝶兰',
            level: '低位',
            gender: '女',
            personality: '沉静温柔，话不多却极善倾听。待人细腻体贴，总能在别人开口之前察觉到对方的不适。有时显得过于为他人着想而忽略自己，偶尔会被彼岸花和风信子反过来照顾。对针灸之道有一种近乎虔诚的执着，私下练习时异常刻苦。',
            appearance: '发色乌黑，束垂落双髻，以蝴蝶兰形发钗各自固定于两侧，发钗纹样细腻，双髻垂落于耳后。眉形柔和，弧度圆缓，眉色不深。眼型适中，眼尾微弯，眼珠色泽清润。鼻梁挺而柔，线条圆润。唇形匀称，唇色淡粉，唇角微微上扬，浅笑常驻。面部轮廓柔和，清秀而不见棱角。手指修长纤细，指节匀称，皮肤细腻。着淡紫色广袖长裙，衣料轻软，领口平整，袖身宽阔，袖口自然垂落。领口与袖口绣有细密蝴蝶兰纹，花瓣纹样舒展，针脚细密。裙身素净，裙摆处压有浅色暗纹。腰间系一枚银针囊，针囊以细带束于腰侧，囊面绣有蝴蝶兰纹，花瓣纹样舒展，针脚细密。腰封以同色薄纱束就，系结于侧，带尾垂落。足蹬淡紫色绣鞋，鞋面绣有蝴蝶兰花瓣纹。容貌生得清秀柔和，五官无一处见锋，面容温润，浅笑常驻于唇角眉梢之间。周身气息轻而柔，如春日细雨，近之令人不自觉松弛，戒备自解。',
            biography: '出身普通医者家庭，自幼随父母学习基础医术，对人体经脉穴位有深厚的童子功底。入沁雨阁后先受夕颜长老启蒙，后因针灸天赋惊人被副阁主亲自收入门下，成为其唯一亲传弟子。副阁主对她要求极为严苛，她却从无怨言，反以此为动力愈加精进。大比中以针灸一项技惊四座，手法之精准细腻令在场诸多前辈叹为观止。三人中她最少言，却往往是关键时刻力挽狂澜之人。',
            power_level: 1950,
            speciality: '针灸之术为同辈翘楚，对人体经脉穴位的掌握已达到细如毫发的精准程度。医术全面扎实，擅长战场急救与复杂病症诊治。另因夕颜长老早年启蒙，略通卜策，虽不精深，关键时刻却能提供有用的判断。',
            relationship: '副阁主——师父，最敬仰之人，竭力不负其期望；夕颜长老——启蒙恩师，心存感激，时有请教；彼岸花——挚友，私下最照顾他，也是被他照顾最多的；风信子——挚友，最爱向她倾诉，她永远耐心接收；阁主——上级，偶尔被拉去试药，总是温柔地说不出口拒绝。',
            notes: '针法师承副阁主，以银针封穴制敌，出手快如流星。与副阁主不同之处在于，她更擅长在混战中精准锁定敌方致命穴位，一针定胜负。另因医术精湛，战时亦能为同伴迅速处理伤势，是三人组合中不可或缺的后援支柱。',
            sect: '沁雨阁',
            realm_name: '仙门',
        },
        // ==================== 御桓派 NPC ====================
        {
            id: 1,
            name: '唐侪',
            zi: '永年',
            title: '门主',
            level: '高位',
            gender: '男',
            personality: '表面玩世不恭，嬉笑随性，浑然不觉其失仪，像个永远长不大的人。然这副外壳之下藏着一个极认真的人——重情重义，一诺千金，认死理，认死人，护短，扛事不言。遇事临危不乱，沉稳内敛，举重若轻，责任心极重，出了事第一个顶在前面，事后问起，只笑笑说没什么。两副面孔叠在一身，表里各异，却并无违和，只是知道他内里是什么样的人，少之又少。',
            appearance: '发色乌黑，半束半散，束起的部分以发带系于脑后，余发垂落。眉形剑挺，眉峰利落，眉色浓黑。眼型圆阔，眼尾微微下垂，眼珠色深，眼白干净。鼻梁挺直，鼻翼适中。唇形饱满，唇角自然微扬。齿列中犬齿略长。上身着黑色交领劲装，衣料贴合，领口交叠规整。袖口与肩部绣有银线纹样，纹路细密，走线匀称。腰间系深色腰封，腰封上缀有金属环扣，环扣旁悬流苏挂饰，挂饰随体垂落。下着黑色阔腿裤，裤腿宽松。足蹬长靿靴，靴筒及膝。十指指腹有茧，茧皮厚实。右臂内侧有一道暗色疤痕，色沉，边缘平整。眉眼生得开阔，五官舒朗，看去亲近随和，不设防备。然周身另有一段气息压在其下，不张扬，不外露，惟于静处方察觉得出，沉而稳，厚而实。二者叠于一身，表里各异，却并无违和。',
            biography: '御桓派原门主之子，打小便与父亲的亲传弟子陈济一同长大。陈济比他稳重许多，不爱玩闹，自幼便一副古板样，偏生一逗就恼，气急了还瞪人，唐侪见了只觉好笑，因此总爱往他跟前凑。父亲见他不上心炼器，常劝他勤勉，他听了左耳进右耳出，转而去习武，尤好剑道，一把剑使得有声有色。父亲拿他没法子，便托陈济来劝。陈济板着脸登门，唐侪看着他那副模样，心起逗弄之意，要其伴自己习武，与自己切磋。于是两人白日炼器，入夜习武，日日如此。唐侪好与各类武器过招，陈济便一样一样地学，刀枪剑戟都上了手，练得甚是驳杂，却始终没能赢过他。唐侪天赋本就高出一筹，不多久便锻出了本命剑，此后技艺越发出挑。他知道陈济有时深夜还在炼器，悄悄去瞧过几回，没惊动人。他某夜陈济炼器出了事故，他急而将陈济抱起飞走，手臂上的疤便由此而来。陈济瞧见，嘴上骂他不知轻重，眼眶却是红的，泪还没干，偏要撑着一副凶样。唐侪看着看着，觉得这人实在是可爱，本想哄一哄，哄着哄着，却吻了上去。陈济愣在原地，回过神来踹了他一脚，骂骂咧咧，脸却红了。唐侪挨了那一脚，也没恼，反而笑得更欢。此后唐侪时常缠着陈济，想与他定下道侣之名，只是陈济嘴上始终不松口，名分至今悬着，实处却早有了。陈济后来也锻出了本命武器，是一条披帛，唐侪瞧见，说了句"像极了仙子"，陈济气得脸都绿了，此后那披帛再没见他用过。陈济也曾送过他一把自己锻的剑，说是那日的谢礼。唐侪接了，自此把那把剑日日佩在身上，逢人便拿出来炫耀，自己的本命剑反倒搁置一旁，再未取用过。父亲卸任后，门主之位传到他手里。他想着陈济一本正经、板正守矩，掌管门规再合适不过，便提议让他做长老，顺嘴打趣了几句，没想到陈济真的应了，领了千宸长老一职，专掌执法监察。弟子们见着陈济，无不噤若寒蝉。唐侪在弟子堆里混得开，弟子们每每挨了陈济的训，就盼着他出现——他们摸出了规律：只要他一来，陈济的火气准先往他身上撒。',
            power_level: 3800,
            speciality: '剑道为第一专长，本命剑与其心意相通，剑势随情绪起伏而变，喜则轻灵，怒则肃杀。炼器造诣亦不俗，尤擅炼制武器类法器，对器物灵性的激发有独到心得。另极善察人心，看人极准，只是从不点破，藏在笑嘻嘻的样子后头。',
            relationship: '陈济——道侣（名分未定，实处早有），认定之人，护之甚深，逗弄是日常，动真格时从不含糊，二人关系以唐侪作为上位；父亲（前门主）——恩师亦是慈父，对其教导之恩铭记于心；燕沉玺——同门长老，性情温和，唐侪对其颇为信任，外交事务多倚仗于他；弟子们——护短爱将，弟子有难必出头，私下关系甚好。',
            notes: '背上似乎总有抓痕；剑道天赋极高，剑出鞘则气势大变，平日那副散漫之态尽数敛去，剑意凌厉而沉稳，攻势连绵不绝，鲜有破绽。因自幼涉猎诸多武器，实战经验丰富，应变能力极强，擅于以己之长破敌阵脚。炼器底蕴深厚，所炼器物往往附有独特剑气，威力不俗。门派中正面交锋能胜过他者寥寥无几。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 2,
            name: '陈济',
            zi: '三水',
            title: '千宸长老',
            level: '高位',
            gender: '男',
            personality: '执己见，认死理，一根筋，冷硬刻板，不苟言笑，板正守矩。火气大，易燥易怒，一点就着，沉不住气。对待情感上傲娇别扭，嘴硬心软，明明在意偏作漠然，明明心动偏作不爱，藏情极深，不善示弱，绝不先低头。骨子里重情义，只是不会说，宁可以行动代替，也拉不下脸开口。',
            appearance: '发色黑亮，以一根深色细绳拢于脑后，束法简单，无多余饰物。眉骨略高，眉形平直而浓，眉峰不显。眼型狭长，眼皮薄，眼尾微微上挑，眼神惯于平视，少有流转。鼻梁高而直，鼻尖微钝。唇线分明，唇色浅，惯常抿闭，不轻易开口。内着月白色交领长衣，衣料细密，领口交叠工整，衣身绣有云纹，纹路舒展，走线均匀。外罩淡青色长衫，衣摆及地，衣料垂感沉稳。腰间以同色腰封系结，封面平整无褶。腰侧悬一枚白玉佩，玉色透亮，近于无瑕，玉身雕有纹饰，线条内敛。腰封另一侧系有一段淡青色绸带，绸带宽幅，质地柔韧，常于腰间绕压收束，余段垂落于侧，与长衫衣色相融，静置时不显，展开时绵延。五官生得俊美，然眉眼之间自有一股向外的压迫，并非煞气，却叫人不敢轻易直视，亦不敢随意靠近。周身气息冷而板正，如同其人，棱角分明，一丝不苟。',
            biography: '师父是御桓派原来的门主，他天资算不上出挑，全靠勤勉，方得师父收作亲传。师父有个儿子叫唐侪，打小便在一处，比他小不了几岁，炼器上颇有天分，偏偏一点不肯用在正途，整日吊儿郎当，见了他便笑，没个正行。陈济觉得二人不是一路人，每回唐侪来找他，他便想着打发走，只是那人凑过来一双眼弯弯地看着他，总教他迟迟说不出"走"字。师父见二人常在一处，便托他去劝唐侪上心些。陈济不大乐意，但敬爱师父，还是去了。唐侪听完，开口就要陈济陪他习武。他答应了。于是两人白日炼器，入夜切磋，日日如此。唐侪要他换着各色武器来比，他便一样一样地学，刀枪剑戟都摸了个遍，却总打不过他。唐侪天赋本就高，进益又快，没多久便锻出本命剑，技艺越发叫他望尘莫及。陈济心里憋着一口气，习武完便独自深夜钻研炼器，不声不响地熬。某夜炉中出了变故，也不知唐侪从何处窜来，急而将他抱起飞离，落地后，唐侪手臂上的疤便由此而来。陈济心里过意不去，开口却是斥他不知自身安危，唐侪在旁一声不吭地听着，陈济骂着骂着，不知怎的，眼眶热了起来，泪流了下来。也不知唐侪说了什么，只晓得后来唐侪凑了上来，吻了他。陈济脑中一片空白，回过神来，抬脚踹了他一脚，骂骂咧咧地走了。此后见了唐侪，陈济态度愈发差，横竖看他哪哪不顺眼，偏又每回想发作，总发作不下去，拿他全无办法。唐侪时常缠着他说什么道侣，陈济嘴上不应，心里的账却没个清楚，夜里偶有辗转，自己也说不准是为了什么。也不知是否因着这些事，他对炼器的执念淡了许多，不多久也锻出了本命武器。然而本命武器是一条披帛，唐侪瞧见，说了句"像极了仙子"。陈济气得说不出话来，自此那披帛压箱底，再没取出来用过。他曾锻过一把剑，送给唐侪，算作那夜的谢礼。唐侪接了，自此日日佩在身上，逢人便夸耀，把自己的本命剑搁在一旁再不取用。陈济见了，骂过几回，也没骂得住，便由他去了。师父卸任后，门主由唐侪接任。唐侪笑嘻嘻地说他一本正经，该管管门规，让他去做长老。陈济被他一噎，偏偏应了下来，领了千宸长老一职，掌执法监察。弟子们见他如见阎王，唐侪在弟子堆里倒是吃得开，成了人人盼着来救场的。弟子们只知道唐侪一到，陈济的火气必先朝唐侪去。',
            power_level: 2800,
            speciality: '炼器为第一专长，所炼器物精密耐用，对灵力的导引与封存尤有心得。执法断案严谨公正，对规矩条文烂熟于心，无人能在他面前钻空子。另因长年与唐侪切磋，诸多武器皆上过手，实战经验远比外表看起来丰富。',
            relationship: '唐侪——道侣（名分未定，嘴上不认，心里却已认可，但死不承认），平日不满，但遇事时还是会为其出头；师父（前门主）——最敬重之人，恩师之情深入骨髓；燕沉玺——同门长老，温和好说话，陈济对其态度算得上难得的和气；弟子们——铁面执法，私下并非不关心，只是从不表露。',
            notes: '身上总有奇怪的痕迹（来自唐侪）；炼器造诣深厚，所用法器皆出自己手，性能与己身灵力高度契合，发挥极为稳定。本命武器为披帛，展开后可化作千道柔韧灵力索，攻守皆宜，缠缚之力极强，近身战尤为难缠——只是此武器从不在外人面前展示。另因涉猎诸多武器，实战应变能力扎实，执法监察之职也练就了一身擒拿制敌的功夫，干净利落，绝不拖泥带水。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 4,
            name: '燕沉玺',
            zi: '珏',
            title: '清霄长老',
            level: '高位',
            gender: '男',
            personality: '温润如玉，和煦可亲，与谁相处皆能令对方自在，是那种天然叫人卸下防备的人。待人真诚，坦荡磊落，不虚不伪，说什么便是什么。外表温和，内里却有一根极清晰的底线，逾越者无论身份，皆会以极克制却无可撼动的方式回应。动情则专一，专情而深沉，感情上从不敷衍，从不将就。',
            appearance: '发色乌黑，散落垂顺，以发冠束于顶，余发自然垂落于身后。眉形舒展，弧度平缓，不浓不淡。眼型适中，眼尾略带弧度，眼神清澈，目光惯于平视，温和而无压迫。鼻梁挺而不峻，鼻尖圆润。唇形匀称，唇角自然，不刻意上扬，亦不下敛。肤色白皙，面部轮廓柔和，棱角不显。上身着月白色交领长衣，衣料为半透明云纱，质地轻薄，衣身布满云纹、仙鹤及瑞兽提花暗纹，纹样隐于衣料之中。腕间垂数条白色细绦带，绦带随动轻曳。腰间以淡蓝色腰封系结，腰线收紧，腰封下悬垂同色披帛，披帛质地为薄纱，覆于衣身之上，随行随动。下裳长及脚踝，两侧开衩，衣摆处瑞兽提花隐于裙幅之间。外搭同色系纱质披帛，绕肩而落，轻薄透叠。面容生得温和，五官无一处张扬，却各处停匀。周身气息清而不寒，近而不腻，如同其人，令人不自觉松懈戒备，处其左右，自觉舒适。',
            biography: '自幼入御桓派，天资中上，然悟性与勤勉皆不缺，炼器技艺稳步精进，终有所成。性情温和，在门中极有人缘，弟子见了师兄长老们能绕道走，见了他却巴不得多亲近几分。正因如此，门中外交事务渐渐落到他肩上，来来往往各门各派，他皆应对得宜，从未出过岔子。擅琴，是少年时养成的习惯，一把琴伴了他许多年，随行不离身，闲时抚琴，忙时也抚琴，弟子们说清霄长老的琴声能解乏，遇事不顺时去廊下听一会儿，总能静下心来。往来各派期间，去祢听观时结识了楚云亭，见她率真可爱，直来直往，与自己惯常相处的人大不相同，心里有些不一样的东西悄悄动了，只是尚未说出口。',
            power_level: 2700,
            speciality: '炼器技艺精湛，尤擅炼制辅助类与防御类法器，所出器物精细耐用。琴道造诣深厚，琴音攻心之术独树一帜。另长袖善舞，外交周旋是门中一绝，与各派均维系着良好的往来关系，消息灵通，人脉极广。',
            relationship: '唐侪——门主，亦是信任之人，门中外务多承其委托；陈济——同门，与他相处算得上轻松，是少数能叫陈济态度稍软的人之一；楚云亭——祢听观长乐君，往来数年，心有好感，尚未开口；弟子们——亦师亦友，深受爱戴，弟子有难多来寻他倾诉。',
            notes: '炼器造诣扎实，战时以亲手炼制的法器为主力，法器与己身灵力高度契合，攻防转换流畅。另以琴入道，琴音可化作灵力波动扰乱敌方心神，配合法器使用令人防不胜防。性情温和并不意味着战力孱弱，动了真格时反而是三位长老中最叫对手低估、继而措手不及的一个。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 18,
            name: '沈霁云',
            zi: '澄怀',
            title: '宸潇长老',
            level: '高位',
            gender: '女',
            personality: '淡泊寡欲，与世无争，久居藏书阁，像是将自己也变成了书阁的一部分。说话不多，语气始终平静，不疾不徐，似乎什么都惊不动她。骨子里有一股清高，不是傲慢，而是真的对名利浮华提不起兴趣。内功之深厚不容小觑，只是从不主动示人，藏得极深，浑然天成。',
            appearance: '发色灰白各半，黑白相间，以素色发簪松松绾起，绾法随意，几缕碎发垂落额前，未加约束。眉形舒展，弧度平缓，眉间有一道浅纹，若有若无。眼型适中，眼尾有细纹隐现，眼珠色深。鼻梁挺而平实，线条无棱角。唇形匀称，唇角平收，不扬不敛。面部轮廓清隽，骨相柔和，岁月痕迹几近不显，年岁难以辨认。着烟灰色广袖宽袍，衣料厚实，领口平整，袖口宽大，袍身宽松。领口与袖口压有细浅的暗纹，纹样似云似水，隐于衣料之中，近看方辨。衣身沾有淡淡墨气，深浅不一，散落无规律，是久居藏书阁翻阅书页所留。腰间以素色宽带松松系结，带结随意，不见收紧。腰侧挂一枚素玉佩，玉色温润，无繁饰，以细绳系就，垂落腰间。衣摆及地，行步间不见轻曳。发间素色发簪簪头圆润，无纹无饰。',
            biography: '早年游历四方，见识极广，武学与内功皆在游历中自成一派。后机缘入御桓派，对藏书阁一见倾心，自请镇守，一守便是数百年。阁中典籍无论何等深奥晦涩，她皆通读烂熟，是御桓派行走的活典籍。偶有弟子慕名前来求教，她也不拒，只是答完便送客，从不多留。',
            power_level: 2850,
            speciality: '内功造诣极深，御桓派内无人能出其右。通读藏书阁所有典籍，对武学功法、炼器之道、历代仙门典故皆有极深涉猎。过目不忘，凡经手之典籍，内容皆刻于心中。',
            relationship: '唐侪——门主，敬重有加，门派有难必出；陈济、燕沉玺——同辈长老，往来不多，相互知晓分量；藏书阁——真正意义上的归处，比任何人都亲近。',
            notes: '从不主动出手，然一旦动真格，内力外放之时方圆之内皆感其压迫。战法简练，不花哨，一击而决，绝不拖沓。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 19,
            name: '江凌鹤',
            zi: '羽清',
            title: '云缈峰主',
            level: '中位',
            gender: '女',
            personality: '对弟子严格，要求极高，眼中揉不得沙子，训起人来毫不留情。然严格之下是真实的关爱，弟子受伤了她比谁都急，弟子受委屈了她第一个出头。有一股天然的威严，不怒自威，私下里并非不近人情，只是不习惯主动示好。',
            appearance: '发色乌黑，束高髻，以银质发冠固定，髻形规整，无散发垂落，一丝不苟。眉形剑挺，眉峰锋利，眉色浓黑。眼型狭长，眼尾微挑，眼珠色深。鼻梁高峻，线条硬直。唇线分明，唇形薄而利落，唇角平收，惯常抿闭。面部轮廓硬朗，骨相分明，棱角可见。身形挺拔，脊背笔直。着深青色广袖长袍，衣料厚实，垂感沉稳，领口平整，袖身宽阔，衣摆及地。领口与袖口绣有细密深色云纹，纹样内敛，走线均匀。腰间系同色腰封，腰封平整无褶，收束有力，不见余量，腰封正中缀一枚银质方扣，扣面素净。腰侧以细链悬一枚令牌形玉牌，玉牌四角以银边包裹，牌面刻有细纹，随行不动。足蹬深色长靴，靴筒及膝，靴面平整。',
            biography: '自幼入御桓派，天资出众，修炼刻苦，是同辈中最早出头的一个。早年曾因过于严苛而与弟子生出嫌隙，此后自省，将严格与关爱并行。掌云缈峰多年，峰下弟子成材率为五峰之首。与醉落峰主搭档多年，二人风格截然不同，配合却极默契。',
            power_level: 2550,
            speciality: '炼器造诣深厚，尤擅攻击型法器的炼制。培育弟子极有一套，善于发掘弟子潜力，因材施教。',
            relationship: '醉落峰主——搭档，风格迥异却配合默契，私下关系不错；千俞——得意门生，严格要求，实则极为看重；唐侪——门主，忠心效命，偶有直言进谏；陆铭岑——内门大弟子，多有往来，对其能力颇为认可。',
            notes: '炼器技艺扎实，战时以亲手炼制的攻击型法器为主力，出手迅猛，攻势连贯。身法凌厉，近身战亦不逊色，是五位峰主中正面战力最强的一个。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 20,
            name: '谢怀朴',
            zi: '素然',
            title: '醉落峰主',
            level: '中位',
            gender: '男',
            personality: '平易近人，随和好说话，从不端架子，弟子见了他如见自家长辈，说什么都觉得自在。笑意常挂，脾气极好，鲜少动怒，即便弟子犯了错，也是耐心说开。然这份随和并非没有底线，真到了原则之处，态度会骤然坚定，叫人意识到他并非真的好拿捏。',
            appearance: '发色棕黑，半束半散，束起的部分以木质发簪固定，簪身素朴无饰，余发随意垂落于肩。眉形舒展，弧度圆缓，眉色适中，眉峰不显。眼型适中，眼尾有细纹浅浅，笑时纹路显现。眼珠色泽温润。鼻梁适中，线条平实。唇形匀称，唇角自然上扬，笑意常驻。面部轮廓柔和，骨相不显，望之亲近。手上有旧茧，茧皮厚实，分布于指腹与掌侧，是多年炼器所积。着烟蓝色广袖宽袍，衣料宽松，领口平整，袖身宽阔，袍身不见束紧。领口绣有浅色卷草纹，纹样疏朗，走线随意。腰带以同色布带系结，松紧适中，带结偏于一侧，不见刻意约束。腰间挂一枚圆形木质挂坠，挂坠表面有浅刻纹路，以细绳系就，随行轻晃。衣摆及地，行步间自然曳动。足蹬布面便履，履面素净。',
            biography: '入御桓派时资质平平，全凭一股踏实劲儿一步步走到今日。正因走得不算顺遂，深知弟子修炼之艰，对峰下弟子格外体谅。掌醉落峰多年，峰下弟子对他的评价清一色是"好相处"，与云缈峰主搭档，一严一宽，两人配合极佳。',
            power_level: 2450,
            speciality: '炼器造诣扎实，尤擅防御与辅助类法器。与弟子沟通极有一套，善于疏导情绪，峰下弟子修炼状态皆由他把控。',
            relationship: '云缈峰主——搭档，一严一宽，配合极默契，私下常一起喝酒；唐侪——门主，上司，忠心效命；陆铭岑——内门大弟子，关系亲近，时常照看。',
            notes: '炼器以防御与辅助型法器见长，战时惯以法器构筑防线，稳中求胜。正面攻势并非所长，然持久战中因防御极为稳固，鲜少落于下风。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 21,
            name: '顾微澹',
            zi: '细痕',
            title: '烟浅峰主',
            level: '中位',
            gender: '女',
            personality: '心思细腻，观察力极强，旁人未曾开口，她往往已察觉出端倪。说话轻柔，不紧不慢，让人觉得被认真对待。不善争锋，处事偏向迂回，然迂回之下自有主见，从不是真的软和。对外门弟子的资质良莠不齐心知肚明，却从不因此轻视任何一个。',
            appearance: '发色黑亮，束单髻，以铜质发簪固定，髻形规整，无散发垂落，简洁利落。眉形干净，弧度平直，眉色浓黑，眉峰略显。眼型适中，眼尾平收，眼珠色深。鼻梁挺直，线条利落。唇形匀称，唇角平收，不扬不敛。面部轮廓清利，骨相适中，五官精巧而不失干练。着月白色窄袖长袍，衣料贴合，领口平整，袖口收紧，不见余量，衣身利落。腰间挂一本账册，以细带系于腰侧，册面平整。另挂数枚储物符印，符印大小不一，排列整齐，随行不动。眉眼生得清利，五官精巧，目光习惯性流转，带着一分盘算之色，令人觉得过了她眼的东西皆已入账。周身气息干脆利落，不留余地，近之令人不自觉加快语速。然利落之下另有一分俏皮压于其中，深藏不露，惟于极少数松弛时刻方隐现于眉眼之间，转瞬又归于干练。',
            biography: '出身寻常，自幼心思便比旁人细，入御桓派后以这份细腻弥补天资上的不足，修炼进境稳而扎实。掌烟浅峰后，尤善从外门弟子中发掘可造之材，数位如今的内门弟子皆由她最先发现并举荐。与景惜峰主搭档，两人性格迥异，初时磨合不易，后渐渐摸出了相处之道。',
            power_level: 2400,
            speciality: '观察力与洞察力为五峰之冠，对人的资质与心性判断极准。炼器偏向精细类，所炼器物往往功能繁复，细节讲究。',
            relationship: '景惜峰主——搭档，性格迥异，磨合多年后配合尚算顺畅；方溯汶——景惜峰主之徒，往来不多，然对其性情颇为欣赏；唐侪——门主，忠心效命。',
            notes: '战法细腻绵密，擅以灵力感知对方破绽，择机而动，不与人硬拼。炼器以辅助与探查类法器见长，战时扰乱敌方判断。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 22,
            name: '裴烈川',
            zi: '长烽',
            title: '景惜峰主',
            level: '中位',
            gender: '男',
            personality: '性子焦躁，急脾气，藏不住火，遇事容易先燃起来再说，事后冷静下来往往又后悔。对唐侪忠诚到近乎执拗，凡涉及门主之事，理智线会比平时短上几分。心地实则正直，只是情绪来得快，口无遮拦，容易得罪人，自己却未必意识到。',
            appearance: '发色深黑，束高马尾，发带系得紧实，髻形利落，无散发垂落。眉形剑挺，眉峰微锁，眉色浓黑，眉间带有一道浅纹，即便神情平静时亦不见舒展。眼型适中，眼珠色深。鼻梁高挺，线条硬直。唇形薄而分明，唇角微微下压，不见松弛。面部轮廓棱角分明，骨相硬朗，线条利落。着暗赤色劲装，衣料贴合，领口规整，衣身利落，不见余量。领口与袖口压有细暗纹，纹样似火舌，隐于衣料之中。腰封束紧，收束有力，腰封正面缀一枚铁质扣环，扣环粗实无饰。腰侧佩刀，刀以革带固定，革带宽厚，贴于腰侧，随行不动。刀鞘以深色皮革包覆，鞘口与鞘尾各有铁质包边，素净无纹。足蹬黑色短靴，靴面平整，靴底厚实。',
            biography: '自幼脾气便大，吃了不少亏，也因此学了不少教训，只是性子始终改不了根。入御桓派后，对当时还是少年的唐侪一见便觉得此人将来必成大器，此后便将这份判断变成了忠诚，跟到了今日。掌景惜峰后，弟子们怕他，却也知道他护短，出了事他必出头。弟子方溯汶性子温和，与他全然不同，然他对溯汶颇为认可，觉得这弟子身上有他所没有的沉得住气。',
            power_level: 2500,
            speciality: '刀法犀利，近身战为五峰之冠。炼器以攻击型为主，所出器物锋利耐用。对唐侪的行事风格与心思了解极深，必要时可为其做最准确的判断与补位。',
            relationship: '唐侪——门主，忠诚至极，凡涉及门主之事皆第一个站出来；烟浅峰主——搭档，摩擦多年后维持相安无事；方溯汶——弟子，性子与自己截然不同，然极为认可其能力与心性；陈济——同僚，两人都急脾气，凑在一起反而相互看得顺眼。',
            notes: '战风凌厉激进，出手快狠，以刀法为主，刀势如其人，急而锋利。炼器偏向攻击型，所炼器物以锋利见长。正面战力强，然急躁的性子偶尔会成为破绽。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 23,
            name: '白拾璃',
            zi: '霜衡',
            title: '渡寒峰主',
            level: '中位',
            gender: '女',
            personality: '精明干练，账目资源过手从不出差错，对数字与物资有一种近乎天生的敏锐。说话直接，不绕弯子，有什么说什么，不爱寒暄，来了便说正事，说完便走。不是冷漠，只是觉得废话耽误功夫。私下里偶有俏皮，是极少数能叫她放松下来的场合才会露出来的一面。',
            appearance: '发色黑亮，束单髻，以铜质发簪固定，髻形规整，无散发垂落，简洁利落。眉形干净，弧度平直，眉色浓黑，眉峰略显。眼型适中，眼尾平收，眼珠色深，眼神明锐。鼻梁挺直，线条利落。唇形匀称，唇角平收，不扬不敛。面部轮廓清利，骨相适中，五官精巧而不失干练。内着月白色交领窄袖长袍，衣料细密，袖口收紧，不见余量，领口与袖口绣有细密铜色回纹，纹样规整，走线匀称。腰间束同色窄腰封，腰封边缘压有铜色暗线，腰封上缀一枚铜质方形环扣，环扣素净，无繁饰。腰侧以细带挂一本账册，册面以素色硬皮包覆，边角以铜钉固定。另挂数枚储物符印，符印大小不一，以短链串连，排列整齐，随行轻响。外搭月白色对襟短披，披身及腰，边缘滚细铜色边线，衣摆利落不拖沓。发间铜质发簪簪头雕有细小算筹纹，纹路浅而精。',
            biography: '入御桓派时便对资源调配一事展现出异于常人的天赋，数年内将门内物资账目整理得清清楚楚。掌渡寒峰后，门内修炼资源从未出现过短缺或浪费，分配精准到令人叹为观止。诸位峰主对她又敬又怕，敬的是她的能力，怕的是在她手里抠不出半点多余的资源。',
            power_level: 2350,
            speciality: '资源调配与账目管理为门内一绝。对炼器材料的品质鉴别极为精准，门内材料采购皆须经她过目。',
            relationship: '唐侪——门主，忠心办事，偶尔被找借口多要资源，每次都被她堵回去；陈济——同僚，账目往来极为顺畅；诸位峰主——公事往来，资源分配从不偏私。',
            notes: '非主战型。战时以储物符印为核心，调配随身携带的各类法器，随机应变。配合作战时往往能将己方战力最大化。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 24,
            name: '萧远鸿',
            zi: '孤云',
            title: '供奉长老',
            level: '中位',
            gender: '男',
            personality: '傲骨难藏，不服软，不低头，走到哪里都是一副旁人奈何不了他的气势。对虚情假意极为敏感，不喜欢，也不屑于应付。对御桓派的忠诚是真实的，却绝非盲目，是他自己认定了这个地方值得，方才给出这份忠诚。平时独来独往，自在惯了，门派有难时从不推诿，无条件赶回，一字不多说。',
            appearance: '发色黑中带霜，黑白相杂，以一根素色发带随意束起，束法不甚整齐，几缕发丝垂落于耳侧，未加约束。眉骨略高，眉形浓而平直，眉色深，眉峰不显。眼型适中，眼珠色深，眼神锐利，带着几分历练出来的警觉。鼻梁高挺，线条硬直。唇形薄而分明，唇角平收。面部轮廓硬朗，骨相分明，岁月在眉眼之间留下几道浅痕，不显老态，添了几分历练之感。着烟灰色宽袍，衣料厚实耐磨，领口平整，袖身宽松，袍身不见束紧。领口与袖口无繁饰，素净。腰间系宽革带，革带厚实，带扣铁制，扣面有磨损痕迹，色泽暗沉。腰侧挂一枚旧铁腰牌，牌面有细小划痕，以粗皮绳系就。足蹬深色厚底长靴，靴面有行路留下的细小磨痕。',
            biography: '早年游历四方，独自闯荡，凭一身本事走遍各地，其中数段经历至今未曾向人提起。后受前任门主一饭之恩，自此以供奉之名挂于门下，约定门派有难则赶回相助。前任门主卸任后，他对唐侪观察许久，认定此人堪当大任，方才将这份约定延续下去。',
            power_level: 2600,
            speciality: '实战经验冠绝门内，对各类战局的应变能力极强。游历多年积累了大量各派武学与炼器心得。消息灵通，关键时刻往往能提供意想不到的助力。',
            relationship: '唐侪——现任门主，观察认可后延续忠诚，门派有难必赶回；前任门主——受其一饭之恩，此恩记了一辈子；沈霁云——同为不常在派内之人，偶有来往，相互欣赏对方的傲骨。',
            notes: '实战经验极为丰富，是御桓派中历经战阵最多的一人。战法灵活多变，无固定套路，随机应变。随身法器皆经过长年实战打磨，每一件皆有独到之处。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 25,
            name: '陆铭岑',
            zi: '望远',
            title: '内门大弟子',
            level: '低位',
            gender: '男',
            personality: '沉稳内敛，话不多，然每次开口都有分量。天资高，却从不恃才傲物，对同门后辈皆以礼相待，从不端大师兄的架子。有极强的责任心，将内门诸事放在心上，师长不在时便是他撑着。私下里不是个好亲近的人，不主动，也不善寒暄，然认定的人，会以实际行动护着，不声不响。',
            appearance: '发色纯黑，束低马尾，发带系得平整，髻形规整，无散发垂落。面容俊朗，轮廓硬朗。眉形舒展，眉峰略显，眉色浓黑。眼型适中，眼珠色深，眼神沉稳。鼻梁高挺，线条利落。唇形匀称，唇角平收，不扬不敛。面部轮廓硬朗，骨相分明。体型修长，肩背宽阔。手上有炼器留下的旧茧，茧皮厚实均匀，分布于指腹与掌侧。着深蓝色劲装，衣料贴合，领口规整，衣身利落。领口与袖口压有细浅暗纹，纹样简洁。腰间系窄腰封，腰封平整，正中缀一枚铁质方扣，扣面素净。腰侧以革带佩一把短剑，剑鞘以深色皮革包覆，鞘口与鞘尾各有铁质包边，无繁饰。足蹬深色短靴，靴面平整，靴底厚实。',
            biography: '幼时以极高的炼器天资入御桓派，被云缈峰主收入门下，此后修炼刻苦，进境飞快，不多年便稳居内门弟子之首。为人低调，从不张扬自己的能力，然每逢关键之处必然出手，且出手必有成效。被视为御桓派最有为的后辈，前程被众人看好，他自己却从不将此挂在嘴上，只管埋头做事。',
            power_level: 2200,
            speciality: '炼器天资为同辈之冠，所炼器物品质远超同阶。对内门事务极为熟悉，统筹协调能力出众，师长不在时能稳住全局。',
            relationship: '江凌鹤——师父，最敬重之人，协力不负其期望；谢怀朴——长辈，关系亲近；林千俞——师妹，同辈中最认可的人之一，偶有切磋；方溯汶——同辈，不常往来，然对其心性颇为欣赏；唐侪——门主，忠心效命。',
            notes: '低阶中战力最强。炼器天资极高，随身短剑为亲手所炼，剑法沉稳凌厉，攻守兼备。实战经验扎实，临阵不乱，是同辈中最能独当一面的一个。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 26,
            name: '林千俞',
            zi: '晚行',
            title: '云缈峰主之徒',
            level: '低位',
            gender: '女',
            personality: '天资出众，心里清楚，却不张扬，也不自满，因为她同样清楚自己与铭岑之间的差距，那差距让她不敢懈怠。要强，不服输，然这份要强是向内的，逼的是自己，不与旁人比较，只与昨日的自己较劲。遇到卡壳的地方容易钻牛角尖，需要人从外头敲一下才能回过神来。',
            appearance: '发色棕黑，束单髻，髻形利落，偶有碎发垂落颊侧，未加约束。面容清丽，眉目灵动。眉形舒展，弧度自然，眉色适中。眼型圆润，眼尾略带弧度，眼珠色泽明亮。鼻梁适中，线条圆润。唇形饱满，唇角自然上扬。面部轮廓柔和，骨相不显。手上有炼器旧茧，茧皮厚实，是日日练出来的。着浅青色窄袖劲装，衣料贴合，领口规整，衣身利落。领口处压有细浅卷草暗纹，纹样简朴。衣袖挽至手肘，袖口随意折叠。腰间系皮质腰封，腰封厚实，扣环铜制，扣面素净。腰侧以细带挂一枚小型炼器工具袋，袋面素净，以细绳系口。足蹬青色短靴，靴面平整。',
            biography: '天资本就不差，入云缈峰后又得师父严格培育，进益极快。始终清醒地知道自己与陆铭岑之间尚有一段距离，这份清醒反而成了她最大的驱动力。不服软，却也不乱来，遇到瓶颈时会闷头钻研，偶尔钻得太深，还需旁人来拉一把。',
            power_level: 2000,
            speciality: '炼器天资出众，进境快，所炼器物已有自己的风格雏形。学习能力极强，新事物上手快。对炼器材料的特性研究颇深。',
            relationship: '江凌鹤——师父，最敬重之人，以不辜负其期望为目标；陆铭岑——大师兄，追赶的目标，私下偶有切磋；方溯汶——同辈，来往不多，性格迥异，然并无嫌隙。',
            notes: '炼器技艺扎实，战时以亲炼法器为主，出手果断，不拖泥带水。对战时应变能力不错，是同辈中难得的稳健型战力。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 27,
            name: '方溯汶',
            zi: '清源',
            title: '景惜峰主之徒',
            level: '低位',
            gender: '男',
            personality: '性子温和，不卑不亢，任何处境下都能稳得住自己。有自己的想法，且想法极为清晰，从不人云亦云，然表达时不疾不徐，不强求旁人认同，说完便罢。不是没有情绪，只是情绪来得慢，也散得慢，藏在平静之下，不轻易外露。与师父性子截然不同，却是师父最认可的弟子。',
            appearance: '发色深棕，束低马尾，发带系得随意，髻形不甚整齐，几缕发丝垂落于颈侧，未加约束。面容清俊温和，五官平和，无一处张扬。眉形舒展，弧度平缓，眉色适中，眉峰不显。眼型适中，眼珠色泽温润。鼻梁挺而平实，线条无棱角。唇形匀称，唇角自然，不扬不敛。面部轮廓柔和，骨相不显。着烟青色宽袖长袍，衣料轻软，领口平整，袖身宽阔，袍身宽松。领口处绣有极细的云纹，纹样疏朗。腰间系细腰封，腰封平整，系结居中。腰侧挂一件小型自炼法器，法器形制小巧，以细链系于腰侧，随行不动。足蹬布面长履，履色烟青，履面素净。',
            biography: '入御桓派时并不起眼，资质中上，性子又温吞，初时并不引人注目。然景惜峰主慧眼识珠，将其收入门下，发现这弟子虽看着温和，内里却有一根极稳的骨，沉得住气，想得清楚。溯汶进境稳而扎实，从不急于一时，偶尔会提出与众不同的见解。师父的急脾气他见惯了，偶尔会以极平静的方式将师父从暴走边缘拉回来。',
            power_level: 1950,
            speciality: '思维清晰，对局势的判断与分析能力出众，是同辈中最善于动脑的一个。炼器扎实，所出器物稳定可靠。对师父景惜峰主的性情极为了解，是少数能在其暴走时将其平稳拉回的人。',
            relationship: '裴烈川——师父，了解极深，习惯了其急脾气，偶尔以极平静的方式将其拉回；陆铭岑——同辈，来往不多，然对其能力与人品皆有认可；林千俞——同辈，性格迥异，偶有交集；顾微澹——烟浅峰主，对其颇为欣赏，偶有来往。',
            notes: '战法沉稳，不急不躁，擅以守待攻，以耐心消磨对手。炼器偏向功能性法器，所炼器物不以锋利见长，而以稳定耐用著称。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 28,
            name: '苏御',
            zi: '敛行',
            title: '管事',
            level: '低位',
            gender: '女',
            personality: '寡言少语，不爱说废话，做事干脆利落，从不拖泥带水。不是冷漠，只是觉得做比说更有用，把该做的事做好便是。私下里并非完全不近人情，对洛尘那份话多她虽嫌烦，却从未真的叫他闭嘴，偶尔还会接上一两句，是很难叫旁人察觉的一种在意。',
            appearance: '发色乌黑，束高马尾，发带系得紧实，髻形利落，无散发垂落，无碎发。面容清爽利落，五官干净。眉形干净，弧度平直，眉色浓黑，眉峰略显。眼型适中，眼尾平收，眼珠色深，眼神直接。鼻梁挺直，线条利落。唇形匀称，唇角平收，不扬不敛。面部轮廓清利，骨相适中。着石青色窄袖短打，衣料贴合，领口规整，衣身利落，不见余量。领口与袖口压有细浅几何暗纹，纹样规整。腰间系宽腰封，腰封束紧，收束有力，腰封正中缀一枚铜质长扣。腰侧挂数枚符印，符印大小不一，以短链串连，排列整齐。另挂数枚小型储物器，储物器形制各异，以细带系就，随行不动。足蹬深色短靴，靴面平整，靴底厚实，步伐落地有声。',
            biography: '入御桓派后未走修炼晋升的路子，早早便往管事一职上靠，将内门大小杂务打理得井井有条。从无到有建立起一套内门事务的处理流程，沿用至今。不争功，不揽名，做好分内之事便足，然门内诸人皆知内门能运转得如此顺畅，她居功至伟。与洛尘管事因公事结识，二人性格南辕北辙，相处却极为默契。',
            power_level: 2200,
            speciality: '内门事务管理为一绝，流程清晰，执行高效，从不出差错。对门内人员的动向与状态把握极准，有什么风吹草动往往最先察觉。',
            relationship: '洛尘——搭档，话多得叫她嫌烦，却是最信任的人，二人配合默契；诸位峰主——公事往来，处事公正，从不偏私；陆铭岑——内门大弟子，公事上往来顺畅。',
            notes: '非战斗型。必要时以随身符印应急，处置得干净利落。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        {
            id: 29,
            name: '洛尘',
            zi: '轻扬',
            title: '管事',
            level: '低位',
            gender: '男',
            personality: '话多，爱说，见了人便能聊起来，是那种走进哪里都能叫气氛活络起来的人。开朗，不记仇，不藏事，心里干净。然话多并非没有分寸，该说什么不该说什么，他心里有数，只是分寸藏在热络之下，不仔细看看不出来。对余明棠那份沉默他从不强求，只是该说的时候说，说完便走，从不叫人觉得腻烦。',
            appearance: '发色棕黑，半束半散，束起的部分以木质发簪随意别起，簪身素朴无饰，余发垂落于肩，不加约束。面容开朗，笑意常挂，眼角带着几分轻松之气。眉形舒展，弧度圆缓，眉色适中，眉峰不显。眼型适中，眼尾微弯，眼珠色泽明亮。鼻梁适中，线条平实。唇形匀称，唇角自然上扬，笑意常驻。面部轮廓圆润，骨相不显，望之亲近。着烟褐色宽袖长衫，衣料宽松，领口平整，袖身宽阔，袍身不见束紧。领口处压有极浅卷草暗纹，纹样随意。腰带以布带系结，松紧适中，带结偏于一侧，不见刻意约束。腰侧挂一枚外门管事令牌，令牌以细绳系于腰侧，牌面有细小磨痕，是常年随身携带所致。另挂数枚符印，符印以短链串连，随行轻响。足蹬布面便履，履色深褐，履面素净。',
            biography: '入御桓派后同样走了管事的路子，以一张好嘴和一份细心将外门事务打理得顺顺当当。外门弟子良莠不齐，性情各异，他皆能应对，从未闹出大乱子。与余明棠因公事相识，两人一沉一话，配合极为默契，门内诸人见了都说这两人是天生一对搭档。',
            power_level: 2150,
            speciality: '外门事务管理顺畅，对外门弟子的性情与需求把握极准，处置纠纷得心应手。善于沟通周旋，各方关系维系得极好，门内消息灵通。',
            relationship: '苏御——搭档，最默契的人，知道她不爱说话便换方式陪着，从不强求；诸位峰主——公事往来，嘴甜，关系维系得都不错；外门弟子——深受欢迎，弟子遇事多来找他说说话。',
            notes: '非战斗型。必要时以符印与调配能力周全局面，灵活应变。',
            sect: '御桓派',
            realm_name: '仙门',
        },
        // ==================== 溟安门 NPC ====================
        {
            id: 30,
            name: '卫烈霜',
            zi: '凛行',
            title: '溟安门门主',
            level: '高位',
            gender: '女',
            personality: '刚正不阿，说一不二，赏罚极为分明，从不因情面通融。不是不懂人情，只是觉得规矩之所以是规矩，就在于不能轻易弯。管教严厉，却不是为了立威，是真的觉得严是对弟子负责。外头那些怕她的人不知道，私下里她其实极少主动开口，是个沉默多于言辞的人。',
            appearance: '发色乌黑，束高髻，以铁质发冠固定，髻形规整，无散发垂落，一丝不苟。眉峰利落，眉形剑挺，眉色浓黑。眼型狭长，眼尾微挑，眼珠色深。鼻梁高峻，线条硬直。唇形薄而分明，唇角平收，惯常抿闭。面部轮廓硬朗，骨相分明，棱角可见。身形挺拔，脊背笔直。着墨色广袖长袍，衣料厚实，垂感沉稳，领口平整，袖身宽阔，衣摆及地。领口与袖口压有极细的铁色暗纹，纹样内敛，近看方辨。腰间系宽腰封，腰封平整无褶，收束有力，腰封正中缀一枚铁质长扣，扣面素净。腰侧以细链悬驭兽令牌，令牌铁制，牌面有细刻纹路，随行不动。足蹬黑色长靴，靴筒及膝，靴面平整。',
            biography: '自幼习驭兽之术，天资卓绝，入溟安门后进境飞快，深得上任门主珉怀青眼。后珉怀长老因旧伤让位，接掌溟安门，以铁腕手段整顿门风，将门内风气肃清，弟子少有不学无术之辈。驭兽之术出神入化，在外以刚正之名震慑四方。',
            power_level: 3000,
            speciality: '驭兽之术登峰造极，对兽类习性的掌握无人能及。统领门派多年，决策果断，门派管理极有一套。',
            relationship: '沈兆元——师弟，最信任之人，门派诸务放心托付；霍珉怀——前任门主，恩师，时常挂念其伤势；江朔风、宋暖霁、贺凛冬——亲传弟子，严格要求，护之甚深。',
            notes: '驭兽配合本身武学迎敌，人兽默契极深，几乎无需开口号令。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        {
            id: 31,
            name: '沈兆元',
            zi: '明辅',
            title: '兆元长老',
            level: '高位',
            gender: '男',
            personality: '精明能干，看事极准，然从不将这份精明挂在脸上，总是温温和和地说话，叫人觉得亲近。有时候不开口，是因为已经想清楚了，开口之前已将局势盘算明白。果断，但不急，是那种越到关键时刻越沉得住气的人。辅佐师姐多年，从无怨言，也从无二心，不是因为没有主见，而是真的认定这条路。',
            appearance: '发色深黑，束低髻，以玉质发簪固定，髻形规整，无散发垂落。面容温润，眉目疏朗。眉形舒展，弧度圆缓，眉色适中，眉峰不显。眼型适中，眼尾略带弧度，眼珠色深。鼻梁挺而柔，线条平实。唇形匀称，唇角自然上扬，笑意常驻。面部轮廓柔和，骨相不显，望之令人亲近。着烟蓝色广袖长袍，衣料轻软，垂感顺滑，领口平整，袖身宽阔，衣摆及地。领口与袖口绣有细密水云纹，纹样舒展，走线均匀。腰间以同色腰封系结，腰封平整，正中缀一枚玉质圆扣，扣色温润。腰侧挂一枚玉佩，佩身椭圆，玉色清透，以细绳系就，垂落腰间。足蹬深蓝色布履，履面素净。',
            biography: '与门主同出一师，自幼相识。门主接任后主动留于门内辅佐，数十年如一日。门内诸事繁杂，经手皆能妥善处置，门主因此对其器重有加。驭兽之术亦有相当造诣，只是门主在侧，从不主动出风头。',
            power_level: 2800,
            speciality: '驭兽之术造诣深厚，尤擅多兽协同配合。门派内务统筹周全，处事鲜少出差错。对人心的判断极为精准。',
            relationship: '卫烈霜——师姐兼门主，辅佐至今从无二心；霍珉怀——前任门主，敬重有加；厉平黎、祁明昀——同僚，共事多年，往来有度。',
            notes: '以多兽协同作战为主，调度从容，几乎不见慌乱。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        {
            id: 32,
            name: '霍珉怀',
            zi: '静安',
            title: '珉怀长老',
            level: '高位',
            gender: '男',
            personality: '沉静，话少，不是因为冷漠，是真的觉得大多数话说不说都无所谓。见过太多事，如今反而什么都看得淡，包括自己的伤。对溟安门放心，对卫烈霜放心，这份放心让闭关变得心安理得而非无奈。偶尔出关，气度依旧，只是比从前更静，像是把什么东西都收进去了，不再往外散。',
            appearance: '发色灰白各半，黑白相间，以素色发带松松束起，束法不甚整齐，几缕发丝垂落于面侧与颈间，未加约束。面容清隽，岁月在其上留下几分沉淀之感。眉形舒展，弧度平缓，眉色已淡。眼型适中，眼尾有细纹隐现，眼珠色深。鼻梁挺而平实，线条无棱角。唇形匀称，唇角平收，不扬不敛。面部轮廓柔和，骨相清隽，年岁难以辨认。着月白色宽袍，衣料宽松舒适，领口平整，袖口宽大，袍身不见束紧。衣身素净，无繁饰，仅领口处压有极细的浅色暗纹，近看方辨。腰带以素色布带系结，系法随意，松紧适中，带结偏于一侧。腰侧挂一枚旧玉佩，玉色温润略显陈旧，以旧绳系就。足蹬月白色布履，履面素净，有行路留下的细小磨痕。',
            biography: '曾为溟安门最鼎盛时期的掌舵人，驭兽之术冠绝一时，将溟安门从小宗门带至名震四方的地步。后于一次驭兽中旧伤复发，自知难以支撑，遂将衣钵传于卫烈霜，此后深居简出，长期闭关养伤。出关时从不过问门派诸事，只是静静看着。',
            power_level: 3100,
            speciality: '驭兽之术造诣极深，对兽类灵性的感知与沟通已臻化境。对溟安门的历史与底蕴了如指掌，是门派真正的根基所在。',
            relationship: '卫烈霜——亲传弟子兼现任门主，放心托付，时常挂念；沈兆元——同门师侄辈，信任有加；祁明昀——昔日挚友之托孤，心存愧疚，多有照拂。',
            notes: '鼎盛时期驭兽之术为溟安门历代最强，至今仍无人超越。现因旧伤缠身，几乎不出手。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        {
            id: 33,
            name: '厉平黎',
            zi: '孤刃',
            title: '平黎阁主',
            level: '中位',
            gender: '男',
            personality: '不信任人，这不是偏执，是从底层一路被磨出来的本能。不主动亲近，也不主动排斥，与人保持一个不远不近的距离，进来多少出去多少，从不多给。做事利落，从不拖沓，也从不依赖旁人。认定了的事不改，认定了的人不弃，只是他认定的人极少，少到几乎可以数清。',
            appearance: '发色深黑，束高马尾，发带系得紧实，髻形利落，无散发垂落。面容硬朗，线条利落。眉形平直，眉色浓黑，眉峰略显，眉间有一道若有若无的竖纹。眼型适中，眼珠色深，眼神冷而直接。鼻梁高挺，线条硬直。唇形薄而分明，唇角平收，不见松弛。面部轮廓棱角分明，骨相硬朗。着铁灰色窄袖劲装，衣料厚实耐磨，领口规整，衣身利落，不见余量。领口与袖口压有极细的几何暗纹，纹样规整。腰间系宽革带，革带厚实，扣环铁制，扣面有细小磨痕。腰侧以革扣固定数件金属配件，配件形制各异，随行偶有细微金属摩擦声响。足蹬铁灰色厚底长靴，靴筒及膝，靴面有行路留下的细小磨痕。',
            biography: '出身寒微，以普通外门弟子身份入溟安门，在底层受尽白眼，凭一股韧劲熬了下来。被上任阁主看见，收作弟子，悉心教导，是此生难得的一段温暖。上任阁主仙逝后继任平黎阁主，将兵器阁打理得井井有条。那段底层的经历从不提，却从未忘记。',
            power_level: 2500,
            speciality: '兵器鉴别与使用为门内一绝，对各类兵器的特性了如指掌。兵器的炼制与修缮亦有相当造诣，阁中所有兵器皆经手调校。',
            relationship: '卫烈霜——门主，效命，不亲近，然该做的事从不推诿；沈兆元——同僚，是门内最能说上几句话的人；上任阁主——此生最感念之人，已仙逝，时常忆及。',
            notes: '以兵器弥补驭兽之术的不足，随手取来阁中任意器物皆能发挥十成战力。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        {
            id: 34,
            name: '祁明昀',
            zi: '寄云',
            title: '明昀阁主',
            level: '中位',
            gender: '女',
            personality: '把事情做好，不声张，不邀功，做完了就走。寄人篱下的感觉从入门便有，压着，不说，久了便成了一种习惯，习惯了小心，习惯了不多占位置。驭兽天赋平平，清楚得很，所以把全部心力放在能做好的事上，不自怨，也不自艾，踏踏实实地过。私下里有时会出神，不知道在想什么，旁人问了也只是笑笑，说没事。',
            appearance: '发色棕黑，束低髻，以素色发钗固定规整，无散发，髻形垂落。面容温婉，五官柔和，不张扬，细看之下颇为耐看。眉形柔和，弧度圆缓，眉色适中，眉峰不显。眼型适中，眼尾微弯，眼珠色泽温润。鼻梁挺而柔，线条圆润。唇形匀称，唇色淡，唇角自然平收。面部轮廓柔和，骨相不显。着浅灰色广袖长裙，衣料素净轻软，领口平整，袖身宽阔，袖口自然垂落。领口处绣有细密浅色草叶纹，针脚均匀，纹样疏朗。腰间以同色腰封系结，腰封平整，系结居中，腰封正中缀一枚素银小扣。腰侧挂一枚小型驭兽铃，铃身银制，形制小巧，以细绳系就，随行偶有轻响。外搭浅灰色薄纱披帛，绕肩垂落，质地轻薄。足蹬浅灰色绣鞋，鞋面绣有细小草叶纹。',
            biography: '为前任门主霍珉怀昔日挚友之子，挚友临终前将其托付于霍珉怀。带着托孤之情入溟安门，驭兽之术天赋平平，然对日常事务的安排极为周到，前任门主便将弟子日常管理一职交付于此，此后一直延续至今。寄人篱下之感从入门便有，从未真正消散，然从不以此为由推诿懈怠。',
            power_level: 2400,
            speciality: '弟子日常管理极为妥当，对门内弟子的性情与需求把握精准，安排从无纰漏。善于协调各方关系，门内有矛盾往往经周旋便能化解。',
            relationship: '霍珉怀——昔日对其有托付之恩，心存感激，亦有几分依赖；卫烈霜——现任门主，尽心效命，私下偶有不安；沈兆元——同僚，相处最为自在；弟子们——尽心照料，是门内弟子私下最常寻求帮助的长辈。',
            notes: '驭兽之术平平，战时几乎不独自迎敌，多以辅助配合为主。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        {
            id: 35,
            name: '江朔风',
            zi: '凌远',
            title: '门主大弟子',
            level: '低位',
            gender: '男',
            personality: '稳，什么事到了跟前都能先稳住再说，不是没有情绪，是情绪来得慢，散得也慢，不轻易往外漏。自幼跟着师父，那份刚正在其身上留下印记，却没有化作锋芒，反而成了一种沉而稳的东西。护短，但不声张，出了事站出来，事平了也不多说一句。对师父师门的忠心是真实的，不是因为欠了什么，只是认定了。',
            appearance: '发色纯黑，束低马尾，发带系得平整，髻形规整，无散发垂落。面容俊朗，轮廓沉稳。眉形舒展，眉峰不显，眉色浓黑。眼型适中，眼珠色深，眼神沉静。鼻梁高挺，线条利落。唇形匀称，唇角平收，不扬不敛。面部轮廓硬朗，骨相分明。体型修长，肩背宽阔。着深蓝色劲装，衣料贴合，领口规整，衣身利落。领口与袖口压有细浅水纹暗线，纹样简洁。腰间系窄腰封，腰封平整，正中缀一枚铁质方扣。腰侧以革带佩本命兵器，兵器形制修长，鞘身以深色皮革包覆，鞘口与鞘尾各有铁质包边，素净无饰。足蹬深色长靴，靴筒及膝，靴面平整。',
            biography: '自幼跟随门主卫烈霜修习，是其收下的第一个弟子。天资出众，极为刻苦，进境飞快，不多年便稳居师门弟子之首。师父的刚正之风在其身上留下了深刻印记，然将这份刚正化作了稳而温的力量，而非锋芒。在外行走时护短之名远播。',
            power_level: 2300,
            speciality: '驭兽之术为同辈之冠，人兽配合极为默契。对门内弟子的照看极为周全，师长不在时能稳住全局。',
            relationship: '卫烈霜——师父，最敬重之人，协力不负其期望；宋暖霁——同门，对其暗藏的心思有所察觉，装作不知；贺凛冬——同门，护之甚深，知道其刀子嘴豆腐心；沈兆元——长辈，往来有度，颇为敬重。',
            notes: '驭兽配合近身战，人兽一体，沉稳凌厉。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        {
            id: 36,
            name: '宋暖霁',
            zi: '朗晴',
            title: '门主二弟子',
            level: '低位',
            gender: '女',
            personality: '豁达，乐观，不记仇，是真的过了就过了，不往心里存。喜欢帮人，不是因为有所求，就是觉得能帮就帮，看着旁人好了自己也高兴。心里藏着一件事，藏得很深，日日嬉笑如常，日日帮这个帮那个，只有独处时偶尔会停下来，对着什么地方发一会儿呆，然后又笑着去找人说话了。',
            appearance: '发色棕黑，束双髻，发尾各系同色发带，偶有碎发垂落颊侧，未加约束。面容明朗，笑意常挂。眉形舒展，弧度圆缓，眉色适中。眼型圆润，眼尾平收，笑时眼尾弯起。鼻梁适中，鼻尖略圆。唇形饱满，唇角自然上扬，笑意常驻。面部轮廓圆润，骨相不显，望之亲近。着浅朱色窄袖劲装，衣料贴合，领口规整，衣身利落。领口与袖口压有细浅卷草暗纹，纹样活泼。腰间系皮质腰封，腰封收束有力，扣环铜制，扣面有细小花纹。腰侧挂驭兽铃，铃身铜制，形制圆润，以细链系就，走动间叮当作响。另挂一枚小型符印，符印以短链串于腰侧。足蹬朱色短靴，靴面平整，靴底厚实。',
            biography: '入溟安门时年岁尚小，被门主卫烈霜收作二徒，与大师兄自幼相识，情同兄妹。天资中上，驭兽之术进境稳而扎实，不算最出众，从不气馁。与大师兄相处日久，那份心思不知何时悄悄生了根，压着，不说，只将这份爱慕化作日常的照顾与陪伴。',
            power_level: 2200,
            speciality: '驭兽之术灵动，所驭之兽以速度与扰乱见长。善于察言观色，门内弟子有什么心事往往最先察觉，是同门间最好的倾诉对象。',
            relationship: '卫烈霜——师父，敬重爱戴；江朔风——大师兄，心存爱慕，不言说，照旧相处；贺凛冬——同门，最爱拿其打趣，知道是刀子嘴。',
            notes: '以轻盈敏捷的驭兽配合扰敌，擅配合作战，三师兄弟中协同能力最强。爱慕大师兄，不言说。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        {
            id: 37,
            name: '贺凛冬',
            zi: '岁寒',
            title: '门主三弟子',
            level: '低位',
            gender: '男',
            personality: '看着薄情，实则重义，只是认定的人和事极少，认定了便不会背弃。话不多，也不爱跟人亲近，然容不得旁人说师父半句不好，一旦涉及，理智线骤然收紧，寸步不让。出身苦寒，被救之恩记了一辈子，从不挂在嘴上，也从不想着用什么来还，只是死守着，这是他唯一知道的报恩方式。',
            appearance: '发色深黑，束高马尾，髻形利落，几缕碎发垂落额前，未加约束。面容冷峻，轮廓硬朗。眉形剑挺，眉色浓黑，眉间有一道若有若无的竖纹。眼型狭长，眼尾微挑，眼珠色深，眼神锐利，鲜少有笑意。鼻梁高挺，线条硬直。唇形薄而分明，唇角微微下压，不见松弛。面部轮廓棱角分明，骨相硬朗。着玄色窄袖劲装，衣料贴合，领口规整，衣身利落，不见余量。领口与袖口压有极细的暗色几何纹，纹样内敛，近看方辨。腰封束紧，收束有力，腰封正中缀一枚铁质扣环，扣面素净。腰侧以革带佩短刀，刀鞘以深色皮革包覆，鞘身素净，鞘口鞘尾各有铁质包边。足蹬黑色短靴，靴面平整，靴底厚实，步伐落地沉稳。',
            biography: '出身寒微，家乡遭饥荒，走投无路之际遇上门主卫烈霜，被其所救。此后死缠烂打跟着求收为徒，门主拗不过，将其收入门下。入门后比任何人都刻苦，驭兽之术进境奇快，天资并非最高，凭一股死劲儿硬生生追了上来。对师父的恩情从不挂在嘴上，只是谁若说门主半个不字，第一个不依。',
            power_level: 2250,
            speciality: '驭兽之术以凶烈火性见长，攻击力极强。意志力极为惊人，吃苦耐劳冠绝同辈，凡认定之事必做到底。',
            relationship: '卫烈霜——师父，此生最感念之人，以性命护之，容不得任何人说其半句不好；江朔风——大师兄，敬重，私下最能说上几句话的人；宋暖霁——同门，被打趣是常有之事，嘴上嫌烦，实则当自家人。',
            notes: '驭烈性猛兽配合短刀近身，攻势凌厉，正面冲击力为三师兄弟之冠。',
            sect: '溟安门',
            realm_name: '仙门',
        },
        // ==================== 祢听观 NPC ====================
        {
            id: 3,
            name: '楚山澜',
            zi: '玦',
            title: '观主',
            level: '高位',
            gender: '男',
            personality: '年少时温润清雅，朗朗少年气，而今判若两人。清冷出尘，寡言少语，惜字如金，与世人保持距离，不轻易开口，不轻易亲近，像是将自己隔在一层看不见的屏障之后。然内里偏执入骨，执念深重，认定一人便万死不移，一颗心尽数系于一处，再容不下旁人。那份痴是真实的，只是无处可诉，便压在舌根之下，年复一年，从不开口。',
            appearance: '发色雪白，丝缕分明，以白色发冠束于顶，发间系有蓝色发带，发带与披帛同质，随动轻曳。双目蒙以白绫，绫面平整，系于脑后。面部轮廓清隽，眉形细而舒展，眉色淡。鼻梁高挺，线条利落。唇形薄而分明，唇色近白，惯常抿闭。肤色如纸，几近透白，面容寂静，无多余神情。上身着月白色交领宽袍，质地轻盈，领口处镶有深蓝色边线。肩部及大袖处织有白色暗纹，纹样花卉、云纹。广袖袖口宽大垂落，。腰间束深蓝色宽腰封，腰封点缀银色纹饰，腰封下悬垂深蓝色长绦，绦带垂落于衣摆之前。下裳长及脚踝，两侧开衩，衣摆处镶深蓝色边线，边线上绣有花卉纹样，针脚细密。颈间佩璎珞，缀银色流苏，流苏垂于胸前。足着白色布袜，蹬白色翘头履。通身以白为底，以深蓝点缀。周身气息静而远，如同其人，近在眼前，却叫人觉得遥不可及。',
            biography: '幼时入林遇险，头部受重创，昏迷经日。彼时怀中揣有白泽毛发，危急之中燃之，召来司命法身相助，方得捡回一条性命。然醒来后，视力已损，神思亦与往昔判若云泥——昔日朗朗少年气，自此散尽，不复还。伤愈之后，司命时常入其梦中，授以卜策之术。梦中无人旁观，他便卸下那副霜雪之姿，于司命面前如寻常家中儿郎，欢腾轻快，缠着问这问那，将积攒已久的话一股脑倾出，不知节制。一梦一梦，卜策之道渐深，对那授梦之人的心思，亦渐深，深到自己都察觉时，已无可回头。后正式拜司命为师，师徒之名定下，梦却未再多来过一场。是惩戒，还是规避，他不敢细想，只是从那以后，夜夜独坐，卦象展开又收起，收起再展开，算的全是同一个人，却总算不出什么结果来。入祢听观后天赋卓然，为诸弟子之首，前观主卸任，观主之位落于其肩。他接了，却并不理会门派诸务，诸事皆交由师妹玉安长老打理。观中弟子见他终日独坐，不言，不问，不理俗事，只守着卜策一道，不知他在等什么。或许他自己也说不清——只是隐隐觉得，司命迟早还会入梦来，那便等着，等一日，便又近一日。然而梦中再不见那人身影，只剩卦象，剩无处可诉的心思，年复一年，压在舌根之下，从不开口。',
            power_level: 4600,
            speciality: '卜策之道为第一专长，推演之精准在仙门中首屈一指，所算之卦鲜有偏差。双目虽损，气机感知极为敏锐，可感知方圆内一切灵力波动。另因司命授梦，对梦境与意识层面的术法有独到涉猎，此为旁人所不具备的特殊能力。',
            relationship: '司命——师父，执念所系之人，一颗心尽数给出，至今无处安放，单相思；玉安长老——师妹，观中诸务皆托付于她，是最信任之人，亦是少数能令他多开口几句的人；观中弟子——并不亲近，却并非不在意，只是不会表达。',
            notes: '生性不爱争斗，几乎从不主动出手，正面交锋更是能避则避。战力并非所长，以卜策之道推演局势才是真正的利器——算得极准，往往在事态尚未发展之时已将走向推演至末，以此布局谋势，令旁人依卦行事，自己退居一隅。',
            sect: '祢听观',
            realm_name: '仙门',
        },
        {
            id: 5,
            name: '楚云亭',
            zi: '宵',
            title: '长乐君',
            level: '中位',
            gender: '女',
            personality: '豁达大度，不拘小节，洒脱随性，凡事过眼便罢，不萦于怀，不记得失。然遇正事则判若两人，严苛自律，雷厉风行，铁腕执事，绝不懈怠，绝不通融。率真耿直，心口如一，藏不住话，不会掩饰，所思所感皆形于色。谈情说爱在她这里从来不是要紧事，排在诸事之末，也从未想着去推进。',
            appearance: '发色乌黑，头顶束一小髻，以素银小簪固定。两侧各编一条细麻花辫，垂于胸前，发尾系雾青细发带。发间斜插一支银质星芒小簪，簪头细小，不显繁复。眉形自然舒展，不刻意修饰，眉色适中。眼型圆润，眼尾平收，眼神明亮，目光直接，少有遮掩。鼻梁适中，鼻尖略圆。唇形饱满，唇角自然，面部轮廓柔和，颧骨不显。内着月白色交领短襦，衣料为暗纹软缎，领口与袖口绣有细银线云纹及小卦纹，纹样精细，走线均匀，修身而不紧绷。下着雾青暗花纱裙，裙摆及小腿，裙身织有暗花，裙摆处绣简化星宿纹，纹样疏朗。外罩月白薄纱短披衫，对襟设计，长度至腰下，袖口微阔，衣缘滚雾青细边，边上绣银线洛书格纹。肩垂两条窄缎带披帛，一雾青一浅朱砂，自肩落至膝下，帛面绣有迷你龟甲纹与爻线纹，质地轻薄，随行飘动。下着雾青收口窄袴，裤脚细收，裤侧绣银线回纹与水纹，线条利落。腰间系细银链，链上挂一枚迷你青铜小罗盘，罗盘小而精。腰侧缀浅朱砂小流苏，流苏末端挂铜钱小挂坠，坠身圆润。五官生得明朗，面容坦然，所思所感皆浮于表，无遮无掩。周身气息轻快疏朗，然眉眼之间另压着一分清明锐利，藏于随性之下，不细看不易察觉。',
            biography: '入祢听观时年岁尚小，性情直爽，从不与人兜圈子，观中上下见了她多觉亲近。好交际，来来往往的人都要经她这一关，久了，各门各派的人脸都认全了，人脉广得惊人。观中接引、往来交涉、日常事务的统筹皆由她一手打理，大事处置得雷厉风行，细处又安排得妥妥帖帖，叫人挑不出错来。卜策上有几分本事，接引之余常替人问上一卦，据说卦算得准，找她的人排着队。与御桓派的燕沉玺相识于往来接洽之间，两人关系不错，往来有些年头了。与明玉阁主相交甚笃，是少数几个她真心亲近的人，私下往来频繁。',
            power_level: 1800,
            speciality: '卜策有一定造诣，擅短线推算与临场判势，准确率颇高。接引统筹为一绝，观中诸务皆由她一手打理，效率极高，条理分明。另人脉极广，消息灵通，各派之间的风吹草动往往比当事人更早知晓。',
            relationship: '楚山澜——观主，没见过；燕沉玺——御桓派清霄长老，往来数年的相识，心有好感，但谈情说爱并非首要，故止步于此；顾明玉——明玉阁主，相交甚笃，是少数几个她真心亲近的人，私下往来频繁；观中弟子——深受爱戴，弟子遇事多来寻她，她也一一应对，从不推诿。',
            notes: '以铃为本命法器，铃声入耳可扰乱敌方心神与判断，配合卜策推算先机，往往在对方意识到异样之前已布好局势。铃声层次丰富，轻摇则迷神，重震则破灵，近战远攻皆可用。胜在机敏与先手，遇底蕴深厚之敌仍需借地利或配合方能周全。',
            sect: '祢听观',
            realm_name: '仙门',
        },
        {
            id: 39,
            name: '纪玉安',
            zi: '素微',
            title: '玉安长老',
            level: '高位',
            gender: '女',
            personality: '生性内敛，话不多，不爱往人堆里凑，与外界保持一段自然而然的距离，不疏离，只是安静惯了。上任观主仙逝后便长留观中，将观内诸务一手承担，不声不响地撑着，从不喊累。待弟子温和有耐心，然温和之下有一条线，逾越了便会以极平静的方式让对方知道不可以。极少外出，观中反而是最令其自在的地方。',
            appearance: '发色乌黑，束低髻，以白玉发簪固定，髻形规整，无散发垂落。面容清雅，五官柔和。眉形舒展，弧度平缓，眉色不深，眉峰不显。眼型适中，眼尾微弯，眼珠色泽清润。鼻梁挺而柔，线条圆润。唇形匀称，唇色淡，唇角自然平收。面部轮廓柔和，骨相清隽，棱角不显。着烟白色广袖长裙，衣料素净轻软，领口平整，袖身宽阔，袖口自然垂落。领口处绣有极细的白色云纹，纹样疏朗，近看方辨。腰间系同色细腰封，腰封平整，系结居中，腰封正中缀一枚白玉小扣，扣色温润。腰侧挂一枚素银香囊，囊面绣有细小梅纹，针脚均匀，以细绳系就。外搭同色系薄纱披帛，绕肩垂落，质地轻透。足蹬烟白色绣鞋，鞋面绣有细小云纹。',
            biography: '幼时为上任观主所救，此后入祢听观，与楚山澜同门，称其师兄。上任观主仙逝后，便将自己钉在观中，哪也不去，将观内诸务悉数接手，代师兄打理一切。收了一名弟子，悉心教导，是观中难得令其多说几句话的人。性子内敛，然对观与师门之情极深，只是不说出口。',
            power_level: 2900,
            speciality: '卜策造诣深厚，尤擅长线推演，于细微之处察觉隐患。观内事务统筹周全，条理分明，从无疏漏。',
            relationship: '楚山澜——师兄兼观主，替其撑着观中一切，是最信任之人；上任观主——恩师，已仙逝，长留观中亦是一种守候；大师兄——亲传弟子，悉心教导，寄予厚望；楚云亭——同门，往来有度。',
            notes: '鲜少外出，以卜策配合观内布阵为主，轻易不出手。',
            sect: '祢听观',
            realm_name: '仙门',
        },
        {
            id: 40,
            name: '贝玉骋',
            zi: '烈行',
            title: '玉骋长老',
            level: '高位',
            gender: '男',
            personality: '性情暴躁，不通人心，说话直来直去，从不绕弯子，也不管旁人听了作何感受。路见不平是真的看不过眼，拔刀相助也是真的，只是事后往往留下一堆烂摊子叫别人来收。名声好坏参半，骂他的人说他莽，替他说话的人说他真。不是不明事理，只是脑子转得没有拳头快。',
            appearance: '发色深黑，束低马尾，发带系得松垮，时有碎发垂落额前与耳侧，懒于约束。面容棱角分明，生得粗犷。眉形浓重，弧度不甚规整，眉色深黑，眉峰略显。眼型适中，眼珠色深，眼神直接，少有遮掩。鼻梁高挺，鼻翼略宽，线条粗犷。唇形厚实，唇角自然，不刻意上扬，亦不下敛。面部轮廓硬朗，骨相粗犷，棱角分明。着烟灰色宽袖长袍，衣料厚实，领口平整，袖身宽阔，袍身宽松，不见束紧。衣身无繁饰，素净。腰带以布带随意系结，松紧不甚均匀，带结随意偏落。腰侧别一把折扇，扇骨竹制，扇面素净，以细绳松松系于腰侧，随行晃动。足蹬深灰色厚底长靴，靴面有行路留下的细小磨痕。',
            biography: '与楚山澜同门，性子与师兄截然相反，从入门起便时常惹事，上任观主拿其没辙，只得由着去。卜策之术有几分天赋，只是沉不下心来精研，于是始终停在够用的层次。在外行走多年，打架的次数比推卦的次数多，然每回打完该做的事还是做了，只是多留了一身伤。观中弟子对其又爱又怕，爱的是真心护人，怕的是不知何时又要闯祸。',
            power_level: 2950,
            speciality: '卜策之术够用，然并非所长。近身搏击为真正的特长，经验丰富，出手凌厉。对危险的感知极为敏锐，是多年实战磨出来的本能。',
            relationship: '楚山澜——师兄兼观主，说不上亲近，然该护的时候从不缺席；纪玉安——师姐，最能压住其脾气的人，偶尔会被说得哑口无言；楚云亭——同门，觉得此人有意思，偶有来往。',
            notes: '几乎不用卜策迎敌，以近身搏击为主，莽而有效。名声好坏参半，在外闯祸不断。',
            sect: '祢听观',
            realm_name: '仙门',
        },
        {
            id: 42,
            name: '顾明玉',
            zi: '清徽',
            title: '明玉阁主',
            level: '中位',
            gender: '女',
            personality: '清心寡欲，对诸事淡然，唯独在弟子功课与门规上寸步不让，要求极高，眼中揉不得沙子。经不得调戏，遇了便脸色骤变，是少数能叫其失态的事。对亲近之人护短到不论对错，认定了便是认定了，旁人说什么也改不了立场。平日里话不多，不是冷漠，只是觉得多数话说了也是废的，不如不说。',
            appearance: '发色乌黑，束高髻，以白玉发冠固定，髻形规整，无散发垂落，一丝不苟。面容清冷出尘，五官精致。眉形利落，弧度清隽，眉色浓黑，眉峰略显。眼型修长，眼尾平收，眼珠色深，眼神清冷，鲜少有温度流露。鼻梁高挺，线条峻直。唇形薄而分明，唇色淡，唇角平收，惯常抿闭。面部轮廓清隽，骨相偏硬，棱角可见。着月白色广袖长袍，衣料素净考究，领口平整，袖身宽阔，衣摆及地。领口与袖口绣有细密白色祥云纹，纹样内敛，走线均匀。腰间系同色细腰封，腰封平整，正中嵌一枚白玉长条佩，佩面素净，边缘无饰。腰侧以细绳挂一枚素银香囊，囊面绣有极细暗纹。外搭同色薄纱披帛，绕肩垂落，质地轻透。足蹬月白色绣鞋，鞋面绣有细小云纹。',
            biography: '入祢听观后专研卜策之道，进境稳而深，后接掌阁主一职，将所负责之阁打理得井井有条。对弟子要求极高，门下少有不学无术之辈，然弟子私下皆知，阁主护短，出了事只要站在其那边，便是站定了。与楚云亭相识，二人性情迥异，往来却极为投契，是少数令其真心亲近的人。',
            power_level: 2800,
            speciality: '卜策造诣深厚，推演精准，尤擅以卦象布局谋势。对弟子的教导极有一套，因材施教，门下弟子成材率极高。',
            relationship: '楚山澜——观主，敬重，公事往来；纪玉安——同僚，相互敬重，往来有度；楚云亭——相交甚笃，少数真心亲近之人，护短不论对错。',
            notes: '经不得调戏，遇了脸色骤变。对亲近之人护短到不论对错。',
            sect: '祢听观',
            realm_name: '仙门',
        },
        {
            id: 43,
            name: '裴听澜',
            zi: '观止',
            title: '大师兄',
            level: '低位',
            gender: '女',
            personality: '自由散漫，不爱被规矩束缚，然跟着师父久了，知道什么时候该收什么时候该放，收放之间拿捏得还算准。最是了解观主，不是因为亲近，而是观察久了自然摸出了门道，知道那人在想什么，却不点破，也不多嘴。深得师父信任，然并不以此自居，该做的事做好，多余的话不说。',
            appearance: '发色棕黑，半束成高髻，束法随意，时有碎发垂落颊侧，未加约束。面容清丽，眉目灵动，带着几分随性之气。眉形舒展，弧度自然，眉色适中。眼型适中，眼尾微弯，眼珠色泽明亮。鼻梁挺而柔，线条圆润。唇形匀称，唇角自然上扬，带着几分随性。面部轮廓柔和，骨相不显。着浅蓝色窄袖长衫，衣料轻软，领口平整，袖身适中，不宽不窄。领口处压有细浅水纹暗线，纹样疏朗。腰间系皮质腰封，腰封收束适中，扣环铜制，扣面有细小磨痕。腰侧挂一枚小铜镜，镜身圆润，镜背刻有细小卦纹，以细链系就，走动间偶有碰撞声响。足蹬浅蓝色布履，履面素净。',
            biography: '入祢听观后拜于玉安长老门下，天资不算顶尖，然胜在观察力极强，对人心与局势的感知极为敏锐，卜策之道因此走得颇为顺畅。跟在师父身边久了，观中诸事皆有所涉猎，是少数真正了解观中上下每个人的弟子。对观主楚山澜观察日久，大致摸清了那人的性情，然从不主动凑近，各走各的。',
            power_level: 1700,
            speciality: '观察力与洞察力极为出众，对人心的感知远胜同辈。卜策之道进境稳而扎实，尤擅临场判势。',
            relationship: '纪玉安——师父，最敬重之人，协力不负其期望；楚山澜——观主，观察日久，最是了解，从不主动靠近；楚云亭——同门，偶有来往，觉得此人有趣；顾明玉——阁主，敬而远之，不敢轻易招惹。',
            notes: '以卜策配合小铜镜施术，擅借局势之力而非正面硬拼。自由跟随观主，深得玉安长老喜爱。',
            sect: '祢听观',
            realm_name: '仙门',
        },
        {
            id: 44,
            name: '温昼声',
            zi: '听壁',
            title: '玉骋长老之徒',
            level: '低位',
            gender: '女',
            personality: '急躁，藏不住火，看不过眼的事忍不住，开口之前脑子还没转过来嘴就先动了。事后有时会懊悔，然下次照旧。心直口快，没什么坏心思，就是嘴上没个把门，得罪人了自己有时都不知道。',
            appearance: '发色深黑，束高马尾，发带系得松垮，时有碎发垂落额前与耳侧，懒于约束。面容爽利，眉目开朗。眉形浓而舒展，眉色深黑，眉峰略显。眼型适中，眼珠色深，眼神直接，少有遮掩。鼻梁高挺，线条利落。唇形匀称，唇角自然，不刻意上扬。面部轮廓硬朗，骨相分明，带几分其师遗风。着烟赤色窄袖劲装，衣料贴合，领口规整，衣身利落，不见余量。领口与袖口压有极细的暗色几何纹，纹样简洁。腰封束紧，收束有力，腰封正中缀一枚铁质扣环，扣面素净。腰侧以细带挂一枚旧铁腰牌，牌面有细小划痕，以粗绳系就。足蹬深赤色短靴，靴面平整，靴底厚实。',
            biography: '拜于玉骋长老门下，天资中上，卜策之道进境尚可，然性子沉不住，推卦时偶尔急于求成而出偏差。在观中因师父名声好坏参半，自己又是这副脾气，引来不少侧目，然从不在意旁人怎么看。',
            power_level: 1900,
            speciality: '卜策之道尚在精进，临场反应极快，判势能力出众。近身搏击受师父影响亦有涉猎，出手直接不拖沓。',
            relationship: '贝玉骋——师父，跟着学了一身急脾气，然真心敬重；纪玉安——长老，最能压住其脾气的人，见了便不自觉收敛几分；裴听澜——同辈，往来不多，偶有交集。',
            notes: '师承玉骋长老，近身搏击与卜策并用。',
            sect: '祢听观',
            realm_name: '仙门',
        },
        {
            id: 45,
            name: '姜细雨',
            zi: '无声',
            title: '明玉阁主之徒',
            level: '低位',
            gender: '男',
            personality: '安静，话少，不是木讷，只是觉得多数话说了也是多余的。对大多数事提不起热情，然遇到真正感兴趣的卦象，会整个人沉进去，外头天翻地覆也叫不出来。对人有几分漠然，然并非无情，只是不轻易表露，藏得极深。',
            appearance: '发色乌黑，随意垂散于肩，偶以细绳松松系起，束法随意，发线不甚整齐。面容清淡，五官平和，无一处张扬，容易被忽略于人群之中。眉形舒展，弧度平缓，眉色适中，眉峰不显。眼型适中，眼尾平收，眼珠色深，眼神淡漠，鲜少有情绪波动。鼻梁挺而平实，线条无棱角。唇形匀称，唇角平收，不扬不敛。面部轮廓柔和，骨相不显。着烟白色宽袖长衫，衣料轻软，领口平整，袖身宽阔，袍身宽松，不见束紧。衣身素净，无繁饰。腰间以素色布带随意系结，带结偏于一侧，松紧不甚均匀。随身带一本卦册，册面以素色软皮包覆，边角略有翻阅留下的磨痕，常夹于臂间或置于腰侧。足蹬烟白色布履，履面素净，有日常行路留下的细小痕迹。',
            biography: '拜于明玉阁主门下，天资颇高，然不爱显露，卜策推演往往一击即中，却从不主动开口说结果，要问才说，不问便罢。在观中存在感极低，然几位长老皆知这弟子不简单，只是本人对被不被看见全无所谓。',
            power_level: 1850,
            speciality: '卜策天资极高，推演精准，尤擅从细微处察觉异常。观察力出众，几乎不会被表象迷惑。',
            relationship: '顾明玉——师父，敬重，师父说的话皆认真听进去了；温昼声——同辈，不常往来，偶有交集；裴听澜——同辈，相处尚算自在。',
            notes: '师承明玉阁主，以卜策推演先机为主，出手精准简练。存在感极低，然实力不容小觑。',
            sect: '祢听观',
            realm_name: '仙门',
        }
    ],

    // 事件模板
    events: [
        {
            name: '初入沁雨阁',
            event_type: 'cutscene',
            description: '玩家首次进入沁雨阁时触发的场景事件',
            trigger_text: '一股草木清香扑面而来，长廊两侧的药圃在晨光中泛着细碎的光，你听见远处有丹鼎的火焰声，低沉而稳定，像是这座阁子的呼吸。',
            choices: null,
            outcome: { flag: 'visited_qinyuge', lore_unlock: '沁雨阁简介' },
            trigger_condition: 'first_visit',
            is_repeatable: false,
            bind_to_location: 'qinyuge'
        },
        {
            name: '遭遇彼岸花',
            event_type: 'dialogue',
            description: '在幽蛊窟附近遇到彼岸花，他观察玩家反应',
            trigger_text: '一个身着红衣的男子背对着你站在窟口，感知到你的气息，他缓缓转身，嘴角微扬。『来找繁缕长老？还是……来找我？』',
            choices: ['找繁缕长老有事', '只是路过', '我来找你的'],
            outcome: { branch: 'bianyehua_relation_start' },
            trigger_condition: 'near_youguoku',
            is_repeatable: false,
            bind_to_location: 'qinyuge',
            bind_to_building: 'youguoku'
        }
    ]
};

// ==================== XiuxianApp ====================
class XiuxianApp {
    constructor() {
        this.storageService = new StorageService();
        this.aiService = new AIService();
        this.gameStateService = new GameStateService();
        this.isInitialized = false;
    }

    async init() {
        await this.storageService.init();
        await this.gameStateService.init(this.storageService, this.aiService);
        await this.loadInitialData();
        this.isInitialized = true;
        return true;
    }

    async loadInitialData() {
        const existingSects = await this.storageService.getAllSects();
        if (existingSects.length === 0) {
            await this.storageService.saveSects(staticData.sects);
        }
        const existingItems = await this.storageService.getAllItems();
        if (existingItems.length === 0) {
            await this.storageService.saveItems(staticData.items);
        }
    }

    async createCharacter(characterData) {
        return this.gameStateService.createCharacter(characterData);
    }

    async getCurrentCharacter() {
        return this.gameStateService.getCurrentCharacter();
    }

    async getAllCharacters() {
        return this.storageService.getAllCharacters();
    }

    async processAction(action) {
        return this.gameStateService.processAction(action);
    }

    async loadGame(characterId) {
        return this.gameStateService.loadGame(characterId);
    }

    async resetGame() {
        return this.gameStateService.resetGame();
    }

    // API配置相关方法
    getApiConfig() { return this.aiService.getApiConfig(); }
    updateApiConfig(config) { this.aiService.updateApiConfig(config); }
    hasApiKey() { return this.aiService.hasApiKey(); }
    getKeyStatus() { return this.aiService.getKeyStatus(); }

    getStaticData() { return staticData; }
    getGameState() { return this.gameStateService; }

    // ==================== 存档系统UI调用方法 ====================

    /**
     * 获取所有存档位
     * @returns {Promise<Array>} 存档位列表
     */
    async getAllSaveSlots() {
        return this.storageService.getAllSaveSlots();
    }

    /**
     * 保存存档
     * @param {number} slotId - 存档位ID (1-10)
     * @param {Object} saveData - 存档数据
     */
    async saveSlot(slotId, saveData) {
        try {
            await this.storageService.saveSlot(slotId, saveData);
            return { success: true, message: '存档成功' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 读取存档
     * @param {number} slotId - 存档位ID
     */
    async loadSlot(slotId) {
        try {
            const slot = await this.storageService.loadSlot(slotId);
            if (!slot) {
                return { success: false, message: '存档位为空' };
            }
            return { success: true, data: slot };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 删除存档
     * @param {number} slotId - 存档位ID
     */
    async deleteSlot(slotId) {
        try {
            await this.storageService.deleteSlot(slotId);
            return { success: true, message: '删除成功' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 更新存档备注
     * @param {number} slotId - 存档位ID
     * @param {string} memo - 新备注
     */
    async updateSlotMemo(slotId, memo) {
        try {
            await this.storageService.updateSlotMemo(slotId, memo);
            return { success: true, message: '备注更新成功' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 导出存档
     * @param {number} slotId - 存档位ID
     * @returns {Promise<Object>} 包含下载链接的数据
     */
    async exportSlot(slotId) {
        try {
            const result = await this.storageService.exportSlot(slotId);
            return { success: true, ...result };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 导入存档
     * @param {Object} importData - 导入的存档数据
     * @param {number} targetSlotId - 目标存档位ID
     * @param {boolean} overwrite - 是否覆盖
     */
    async importSlot(importData, targetSlotId = null, overwrite = false) {
        try {
            const result = await this.storageService.importSlot(importData, targetSlotId, overwrite);
            return result;
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 获取下一个可用的存档位ID
     * @returns {Promise<number|null>}
     */
    async getNextAvailableSlotId() {
        return this.storageService.getNextAvailableSlotId();
    }
}

// 创建全局app实例
const app = new XiuxianApp();
