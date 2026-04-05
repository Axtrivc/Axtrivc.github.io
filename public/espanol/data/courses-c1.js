const COURSES_C1 = { title:'C1 - 高级', units:[
{ id:'c1-1',name:'虚拟式完成时',icon:'🔮',desc:'虚拟式现在完成时与过去完成时',done:false,
  learn:{grammar:{title:'虚拟式完成时变位',rows:[
    ['时态','hablar','comer','vivir'],
    ['现在完成时','haya hablado','haya comido','haya vivido'],
    ['过去完成时','hubiera hablado','hubiera comido','hubiera vivido'],
  ]},
  note:'虚拟式完成时 = haber的虚拟式 + 过去分词。现在完成时(haya+pp)用于已完成但对现在有影响；过去完成时(hubiera+pp)用于过去的过去。常见搭配：espero que haya llegado(我希望他已经到了) / ojalá hubiera sabido(但愿我当初知道)。',
  vocab:[
    {es:'esperar que + haya + pp',zh:'希望(某人)已经…',ex:'Espero que hayas terminado.'},{es:'dudar que + haya + pp',zh:'怀疑(某人)已经…',ex:'Dudo que haya llegado.'},
    {es:'ojalá + hubiera + pp',zh:'但愿(过去)当初…',ex:'Ojalá hubiera estudiado más.'},{es:'es posible que + haya + pp',zh:'可能已经…',ex:'Es posible que haya salido.'},
    {es:'no creo que + haya + pp',zh:'我不认为已经…',ex:'No creo que lo haya hecho.'},{es:'si hubiera + pp, habría + pp',zh:'如果当时…就…了',ex:'Si hubiera sabido, habría ido.'},
  ]},
  quiz:[
    {type:'fill',q:'"haber"的yo虚拟式现在时是？',answer:'haya',explain:'haya是haber的虚拟式现在时'},
    {type:'fill',q:'"haber"的yo虚拟式过去未完成时是？',answer:'hubiera',explain:'hubiera是haber的虚拟式过去未完成时'},
    {type:'choice',q:'"Ojalá hubiera venido"中hubiera venido是？',options:['虚拟式现在完成时','虚拟式过去完成时','条件式','不定过去时'],answer:1,explain:'hubiera+pp=虚拟式过去完成时，表达对过去未实现的遗憾'},
    {type:'fill',q:'"我希望你已经完成了"用西语虚拟式完成时？',answer:'Espero que hayas terminado',explain:'espero que+haya+过去分词'},
    {type:'choice',q:'"Dudo que haya llegado"中haya llegado为什么用虚拟式？',options:['因为dudar要求虚拟式','因为llegar是不规则动词','因为时态需要','因为haber只能虚拟式'],answer:0,explain:'dudar que后必须跟虚拟式，haya llegado=虚拟式现在完成时'},
  ]
},
{ id:'c1-2',name:'间接引语高级',icon:'💬',desc:'时态转换·引述动词·转述意图',done:false,
  learn:{grammar:{title:'间接引语时态转换规则',rows:[
    ['直接引语时态','间接引语时态','例句'],
    ['现在时(Presente)','不定过去时(Pret.Indef.)','"Voy" → Dijo que fue/iba'],
    ['过去未完成时(Imperfecto)','过去完成时(Pret.Plus.)','"Iba" → Dijo que había ido'],
    ['不定过去时(Pret.Indef.)','过去完成时(Pret.Plus.)','"Fui" → Dijo que había ido'],
    ['将来时(Futuro)','条件式(Condicional)','"Iré" → Dijo que iría'],
    ['虚拟式现在时','虚拟式过去未完成时','"Quiero que vengas" → Dijo que quería que vinieras'],
  ]},
  note:'转述他人话语时需要调整时态。引述动词常用：decir(说)、explicar(解释)、preguntar(问)、contestar(回答)、admitir(承认)、negar(否认)、insistir(坚持)。注意：疑问句转述用si：¿Vienes? → Me preguntó si venía.',
  vocab:[
    {es:'decir que',zh:'说(引述)',ex:'Me dijo que vendría mañana.'},{es:'preguntar si',zh:'问是否',ex:'Me preguntó si tenía tiempo.'},
    {es:'admitir que',zh:'承认',ex:'Admitió que se había equivocado.'},{es:'negar que + subj.',zh:'否认',ex:'Negó que hubiera hecho algo malo.'},
    {es:'insistir en que + subj.',zh:'坚持要求',ex:'Insistió en que yo fuera.'},{es:'acusar a alguien de',zh:'指控某人',ex:'Lo acusaron de mentir.'},
  ]},
  quiz:[
    {type:'choice',q:'"Vengo mañana"转间接引语用哪个时态？',options:['现在时','不定过去时','过去未完成时','将来时'],answer:1,explain:'直接引语现在时→间接引语不定过去时'},
    {type:'fill',q:'"¿Tienes tiempo?"转间接引语？',answer:'Me preguntó si tenía tiempo',explain:'疑问句转述用si，tienes→tenía'},
    {type:'choice',q:'"Fui al cine"转间接引语后fui变成？',options:['fue','había ido','iba','iría'],answer:1,explain:'不定过去时fui→过去完成时había ido'},
    {type:'fill',q:'引述动词"否认"用西语？',answer:'negar',explain:'negar que+虚拟式=否认'},
    {type:'choice',q:'"Iré a la fiesta"转间接引语？',options:['Dijo que irá','Dijo que iba','Dijo que iría','Dijo que ha ido'],answer:2,explain:'将来时→条件式：iré→iría'},
  ]
},
{ id:'c1-3',name:'条件式复合句',icon:'🧩',desc:'Si从句三种类型·混合条件·省略结构',done:false,
  learn:{grammar:{title:'三种Si条件句',rows:[
    ['类型','Si从句','主句','例句'],
    ['Type 0(事实)','Presente','Presente','Si llueve, me mojo.'],
    ['Type 1(可能)','Presente','Futuro','Si llueve, me mojaré.'],
    ['Type 2(不太可能)','Imperfecto Subj.','Condicional','Si lloviera, me mojaría.'],
    ['Type 3(不可能)','Pluscuamperfecto Subj.','Condicional Comp.','Si hubiera llovido, me habría mojado.'],
    ['混合(过去→现在)','Pluscuamperfecto Subj.','Condicional Simple','Si hubiera estudiado, aprobaría ahora.'],
  ]},
  note:'条件句可以混合使用！Si+虚拟过去完成时+条件式现在=如果当初…现在就会…。省略si可以倒装：De haber sabido, habría ido(如果知道的话我就去了)。',
  vocab:[
    {es:'a no ser que + subj.',zh:'除非',ex:'Iré a no ser que llueva.'},{es:'con tal de que + subj.',zh:'只要',ex:'Vendré con tal de que me inviten.'},
    {es:'a condición de que + subj.',zh:'在…条件下',ex:'Te ayudaré a condición de que estudies.'},{es:'siempre y cuando + subj.',zh:'只要…就',ex:'Siempre y cuando tengas tiempo.'},
    {es:'de + infinitivo(省略si)',zh:'如果(省略结构)',ex:'De saberlo antes, no habría venido.'},{es:'en caso de que + subj.',zh:'万一',ex:'En caso de que nieve, cancelaremos.'},
  ]},
  quiz:[
    {type:'choice',q:'"Si estudio, apruebo"属于哪种条件句？',options:['Type 0(事实)','Type 1(可能)','Type 2(不太可能)','Type 3(不可能)'],answer:0,explain:'Si+现在时+现在时=一般事实/规律'},
    {type:'fill',q:'"Si hubiera estudiado, habría aprobado"中hubiera estudiado是？',answer:'虚拟式过去完成时',explain:'Type 3: Si+Pluscuamperfecto Subj.'},
    {type:'choice',q:'"a no ser que"后面跟什么？',options:['直陈式','不定式','虚拟式','条件式'],answer:2,explain:'a no ser que+虚拟式=除非'},
    {type:'fill',q:'省略si用de+infinitivo说"如果知道的话"：',answer:'De saberlo',explain:'De+haber的infinitivo=省略si的条件句'},
    {type:'choice',q:'混合条件"如果当初学了，现在就会说"怎么表达？',options:['Si estudiara, hablo','Si hubiera estudiado, hablaría','Si estudié, hablaré','Si estudiara, hablaría'],answer:1,explain:'过去原因(hubiera+pp)+现在结果(condicional simple)'},
  ]
},
{ id:'c1-4',name:'高级被动与无人称',icon:'🔄',desc:'ser+pp·se被动·无人称se·使役结构',done:false,
  learn:{grammar:{title:'被动语态对比',rows:[
    ['结构','例句','意思'],
    ['ser + pp (por-agente)','El libro fue escrito por Cervantes.','这本书是塞万提斯写的。'],
    ['se + 三单','Se habla español aquí.','这里说西班牙语。'],
    ['se + pp','Se vendieron muchas casas.','卖出了很多房子。'],
    ['无人称se + 动词','Se vive bien en España.','在西班牙生活得很好。'],
    ['hacerse + pp','Se hizo daño.','他受伤了。(自反被动)'],
    ['dejarse + pp','El problema se dejó sin resolver.','问题被搁置了。'],
  ]},
  note:'ser+pp强调动作执行者(可加por)；se被动更常见口语化，不强调执行者。se+pp注意数的一致：se venden casas(复数)/se vende la casa(单数)。无人称se不出现主语，类似英文one/they。',
  vocab:[
    {es:'ser construido',zh:'被建造',ex:'La catedral fue construida en el siglo XIII.'},{es:'se espera que',zh:'预计(被动)',ex:'Se espera que llegue mañana.'},
    {es:'se sabe que',zh:'众所周知',ex:'Se sabe que el cielo es azul.'},{es:'se prohíbe + inf.',zh:'禁止',ex:'Se prohíbe fumar aquí.'},
    {es:'se permite + inf.',zh:'允许',ex:'Se permite aparcar aquí.'},{es:'estar + pp (状态)',zh:'处于…状态',ex:'La puerta está cerrada.(门关着，不是被关的动作)'},
  ]},
  quiz:[
    {type:'choice',q:'"Se vendieron muchas casas"中se的作用是？',options:['自反代词','被动标记','间接宾语','直接宾语'],answer:1,explain:'se+过去分词=被动语态，复数一致'},
    {type:'fill',q:'"禁止停车"用无人称se？',answer:'Se prohíbe aparcar',explain:'se prohíbe+infinitivo=禁止'},
    {type:'choice',q:'"El edificio fue construido"和"Se construyó el edificio"的区别？',options:['没有区别','前者强调执行者，后者更口语','前者更口语','后者强调执行者'],answer:1,explain:'ser+pp可加por强调执行者；se被动更自然口语化'},
    {type:'fill',q:'"预计明天到达"用se被动？',answer:'Se espera que llegue mañana',explain:'se espera que+虚拟式=预计'},
    {type:'choice',q:'"está cerrado"和"fue cerrado"的区别？',options:['没区别','前者表状态，后者表动作','前者表动作，后者表状态','前者是现在时，后者是将来时'],answer:1,explain:'estar+pp=状态(关着)；ser+pp=被动动作(被关了)'},
  ]
},
{ id:'c1-5',name:'书面语体与连接词',icon:'✍️',desc:'正式写作·学术连接词·段落结构',done:false,
  learn:{grammar:{title:'学术/正式连接词',rows:[
    ['类型','连接词','例句'],
    ['添加','Además / Asimismo / Por añadidura','Además, debemos considerar...'],
    ['转折','Sin embargo / No obstante / Por el contrario','No obstante, hay excepciones.'],
    ['因果','Por consiguiente / Por lo tanto / En consecuencia','Por lo tanto, concluyo que...'],
    ['对比','En cambio / Mientras que / A diferencia de','En cambio, otros estudios muestran...'],
    ['总结','En resumen / En conclusión / Para concluir','En conclusión, los datos confirman...'],
    ['举例','A modo de ejemplo / Por citar un caso','Por citar un caso, en España...'],
    ['强调','En particular / Especialmente / Sobre todo','En particular, el sector tecnológico.'],
    ['让步','A pesar de (que) / Pese a (que)','A pesar de las dificultades, lograron...'],
  ]},
  note:'书面语和口语差距很大。写作时应避免：contracción(al→a el无)、mismo作为连接词、过度使用y/pero。学术论文常用虚拟式表达可能性、假设、建议。段落结构：主题句→展开→例证→总结。',
  vocab:[
    {es:'no obstante',zh:'然而/不过(正式)',ex:'No obstante, el resultado fue positivo.'},{es:'por lo tanto',zh:'因此(正式)',ex:'Está lloviendo; por lo tanto, me quedo.'},
    {es:'en resumen',zh:'总之/综上所述',ex:'En resumen, el proyecto es viable.'},{es:'a pesar de que',zh:'尽管(正式)',ex:'A pesar de que era difícil, lo logró.'},
    {es:'por añadidura',zh:'此外(正式)',ex:'Vino Juan; por añadidura, María.'},{es:'es menester',zh:'有必要(非常正式)',ex:'Es menester tomar medidas urgentes.'},
  ]},
  quiz:[
    {type:'choice',q:'哪个是"然而"的正式表达？',options:['pero','sin embargo','también','porque'],answer:1,explain:'sin embargo是"然而"的正式替代，替代口语的pero'},
    {type:'fill',q:'"因此"的正式书面表达是？',answer:'por lo tanto',explain:'替代口语的así que/entonces'},
    {type:'choice',q:'"A pesar de que"后面跟什么？',options:['虚拟式','不定过去时','不定式','将来时'],answer:0,explain:'a pesar de que+虚拟式/直陈式均可，虚拟式更常见'},
    {type:'fill',q:'"综上所述"用西语书面语？',answer:'en conclusión',explain:'en conclusión=综上所述/总而言之'},
    {type:'choice',q:'学术写作中应避免什么？',options:['使用虚拟式','使用太多y和pero','使用连接词','使用长句'],answer:1,explain:'写作应避免过度使用简单连接词y/pero，改用sin embargo/por lo tanto等'},
  ]
},
{ id:'c1-6',name:'高级语法综合',icon:'🎯',desc:'定语从句·副词从句·独立结构·同位语',done:false,
  learn:{grammar:{title:'高级从句结构',rows:[
    ['结构','例句','说明'],
    ['关系从句(无先行词)','Quien trabaja mucho, progresa.','工作努力的人会进步。'],
    ['关系从句(cual)','Lo que más me gusta es...','我最喜欢的是…'],
    ['独立绝对结构','Habiendo terminado, se fue.','完成后他就走了。'],
    ['同位语','Madrid, la capital de España...','马德里，西班牙首都…'],
    ['强调句型','Fue en 1492 cuando Colón...','正是在1492年哥伦布…'],
    ['结果从句','Tanto… que / Tan… que','太…以至于…'],
    ['方式从句','Como si + subj.','好像(虚拟式)'],
  ]},
  note:'独立绝对结构=habiendo+pp/gerundio，充当时间或原因状语。cual指代前面整个从句：Me dijo que vendría, lo cual me sorprendió(他说会来，这让我很惊讶)。强调句用fue…cuando/donde强调时间地点。',
  vocab:[
    {es:'lo que',zh:'…的事物(无先行词)',ex:'Lo que quiero es paz.'},{es:'quienquiera que + subj.',zh:'无论谁',ex:'Quienquiera que venga, será bienvenido.'},
    {es:'dondequiera que + subj.',zh:'无论哪里',ex:'Dondequiera que vayas, te seguiré.'},{es:'cualquiera que + subj.',zh:'无论哪个',ex:'Cualquiera que sea la razón...'},
    {es:'habiendo + pp',zh:'完成后(独立结构)',ex:'Habiendo comido, salimos.'},{es:'fue…quien/lo que',zh:'正是…(强调)',ex:'Fue él quien lo hizo.'},
  ]},
  quiz:[
    {type:'fill',q:'"我最喜欢的是旅行"用lo que？',answer:'Lo que más me gusta es viajar',explain:'lo que+动词=…的事物'},
    {type:'choice',q:'"Habiendo terminado, se fue"是什么结构？',options:['结果从句','独立绝对结构','被动语态','条件句'],answer:1,explain:'habiendo+pp=独立绝对结构，表示完成后的时间'},
    {type:'fill',q:'"无论谁"用西语？',answer:'quienquiera que',explain:'quienquiera que+虚拟式=无论谁'},
    {type:'choice',q:'"lo cual"指代什么？',options:['前面的名词','前面的整个从句','时间','原因'],answer:1,explain:'lo cual指代前面的整个句子内容'},
    {type:'fill',q:'强调"正是他做的"用西语？',answer:'Fue él quien lo hizo',explain:'fue…quien=正是…(强调句型)'},
  ]
},
{ id:'c1-7',name:'西语文学入门',icon:'📚',desc:'经典片段赏析·文学词汇·修辞手法',done:false,
  learn:{grammar:{title:'文学修辞手法',rows:[
    ['手法','西语名','例句','意思'],
    ['隐喻','Metáfora','Sus ojos son dos luceros.','她的眼睛是两颗星星。'],
    ['明喻','Símil','Es valiente como un león.','他像狮子一样勇敢。'],
    ['拟人','Personificación','El viento susurra.','风在低语。'],
    ['夸张','Hipérbole','Tengo un hambre que me muero.','我饿死了。'],
    ['反问','Pregunta retórica','¿Quién no quiere ser feliz?','谁不想幸福呢？'],
    ['排比','Paralelismo','Ven, ve, vence.','来，看，征服。'],
    ['矛盾修辞','Oxímoron','Un silencio ruidoso.','喧闹的沉默。'],
  ]},
  note:'西班牙语文学源远流长：塞万提斯《堂吉诃德》是现代小说起源；加西亚·马尔克斯《百年孤独》开魔幻现实主义先河；博尔赫斯以迷宫和镜子闻名；聂鲁达的情诗被誉为西语最美。阅读原文时注意词汇的古用法和修辞。',
  vocab:[
    {es:'hidalgo',zh:'绅士/贵族(古)',ex:'Era un hidalgo de los de lanza.'},{es:'querencia',zh:'对家乡的眷恋',ex:'Tenía querencia por su tierra.'},
    {es:'sobremesa',zh:'饭后闲聊时光',ex:'La sobremesa duró horas.'},{es:'madrugar',zh:'早起',ex:'Es necesario madrugar.'},
    {es:'atonito',zh:'目瞪口呆的',ex:'Se quedó atónito al verlo.'},{es:'entrañas',zh:'内心深处/五脏六腑',ex:'Me llega a las entrañas.'},
  ]},
  quiz:[
    {type:'choice',q:'"Sus ojos son dos luceros"用了什么修辞？',options:['明喻','隐喻','拟人','夸张'],answer:1,explain:'隐喻(直接等同)：眼睛=星星'},
    {type:'fill',q:'西班牙语现代小说之父是谁的作品？',answer:'Cervantes / 塞万提斯',explain:'《堂吉诃德》El Quijote'},
    {type:'choice',q:'"El viento susurra"用了什么修辞？',options:['隐喻','拟人','夸张','反问'],answer:1,explain:'赋予风"低语"的人类行为=拟人'},
    {type:'fill',q:'"Un silencio ruidoso"是什么修辞手法？',answer:'矛盾修辞 / Oxímoron',explain:'矛盾的形容词组合=矛盾修辞'},
    {type:'choice',q:'《百年孤独》的作者是？',options:['博尔赫斯','聂鲁达','加西亚·马尔克斯','塞万提斯'],answer:2,explain:'García Márquez，魔幻现实主义大师'},
  ]
},
{ id:'c1-8',name:'C1综合挑战',icon:'🏆',desc:'高级语法·词汇·文化综合测试',done:false,
  learn:{grammar:{title:'C1核心语法总览',rows:[
    ['主题','关键点','例句'],
    ['虚拟式完成时','haya/hubiera+pp','Ojalá hubiera sabido.'],
    ['间接引语','时态后移','Dijo que iría(←iré).'],
    ['条件式复合','混合条件','Si hubiera estudiado, aprobaría ahora.'],
    ['被动语态','ser+pp / se被动','Se construyó en 1990.'],
    ['书面连接词','sin embargo, por lo tanto','No obstante, el dato es claro.'],
    ['独立结构','habiendo+pp','Habiendo comido, salió.'],
    ['文学修辞','隐喻/明喻/拟人','Sus ojos son luceros.'],
  ]},
  note:'恭喜你完成了全部40个单元的学习！从A1的字母发音到C1的文学赏析，你已经掌握了约2000小时的西语学习内容。C1水平意味着你可以：阅读西语文学作品原文、理解新闻和学术文章、用西语撰写正式文书、流利参与专业讨论、理解电影/播客中复杂话题。继续保持，向C2冲刺！',
  vocab:[
    {es:'estar al tanto',zh:'了解/知情',ex:'Estoy al tanto de la situación.'},{es:'dar la talla',zh:'够格/有能力',ex:'No dio la talla para el puesto.'},
    {es:'no dar su brazo a torcer',zh:'固执己见',ex:'Mi abuelo no da su brazo a torcer.'},{es:'valer su peso en oro',zh:'无价之宝',ex:'Esta amistad vale su peso en oro.'},
    {es:'ponerse las pilas',zh:'振作起来/加把劲',ex:'¡Ponte las pilas y estudia!'},{es:'ahogarse en un vaso de agua',zh:'小题大做',ex:'Siempre se ahoga en un vaso de agua.'},
  ]},
  quiz:[
    {type:'choice',q:'"Ojalá hubiera sabido"用了什么时态？',options:['虚拟式现在完成时','虚拟式过去完成时','条件式完成时','不定过去时'],answer:1,explain:'hubiera+pp=虚拟式过去完成时'},
    {type:'fill',q:'"No obstante"的意思？',answer:'然而/不过',explain:'正式连接词，替代pero'},
    {type:'choice',q:'"Habiendo terminado"是什么结构？',options:['结果从句','独立绝对结构','条件从句','定语从句'],answer:1,explain:'habiendo+pp=独立绝对结构'},
    {type:'fill',q:'成语"小题大做"用西语？',answer:'ahogarse en un vaso de agua',explain:'字面：淹死在一杯水里'},
    {type:'choice',q:'C1水平应该能做什么？',options:['只会自我介绍','能读文学作品原文','只能点餐','只会说数字'],answer:1,explain:'C1是高级水平，可以阅读文学原著、参与专业讨论'},
  ]
},
]};






