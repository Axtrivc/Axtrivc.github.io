const COURSES_B1 = { title:'B1 - 进阶级', units:[
{ id:'b1-1',name:'虚拟式入门',icon:'💭',desc:'愿望情感建议·虚拟式现在时',done:false,
  learn:{grammar:{title:'虚拟式现在时规则变位',rows:[
    ['人称','hablar(说)','comer(吃)','vivir(住)'],
    ['yo','hable','coma','viva'],['tú','hables','comas','vivas'],
    ['él/ella','hable','coma','viva'],['nosotros','hablemos','comamos','vivamos'],
    ['ellos','hablen','coman','vivan'],
  ]},
  note:'虚拟式表达主观不确定的内容。触发词：espero que, quiero que, no creo que, es importante que, para que。',
  vocab:[
    {es:'espero que + subj.',zh:'我希望…',ex:'Espero que vengas.'},{es:'quiero que + subj.',zh:'我想要…',ex:'Quiero que estudies.'},
    {es:'no creo que + subj.',zh:'我不认为…',ex:'No creo que sea verdad.'},{es:'es posible que + subj.',zh:'可能…',ex:'Es posible que llueva.'},
    {es:'ojalá + subj.',zh:'但愿…',ex:'Ojalá tengas suerte.'},{es:'para que + subj.',zh:'为了…',ex:'Te lo digo para que lo sepas.'},
  ]},
  quiz:[
    {type:'choice',q:'"Espero que ___"后面用什么？',options:['不定式','虚拟式','直陈式','将来时'],answer:1,explain:'espero que+虚拟式'},
    {type:'fill',q:'"hablar"的yo虚拟式是？',answer:'hable',explain:'-ar→-e'},
    {type:'choice',q:'"No creo que + sea"中sea是？',options:['ser直陈式','ser虚拟式','ir虚拟式','ser将来时'],answer:1,explain:'否定creer+虚拟式'},
    {type:'fill',q:'"comer"的él虚拟式是？',answer:'coma',explain:'-er→-a'},
    {type:'choice',q:'"Ojalá"后面跟什么？',options:['直陈式','不定式','虚拟式','条件式'],answer:2,explain:'Ojalá+虚拟式'},
  ]
},
{ id:'b1-2',name:'条件式与条件句',icon:'🔮',desc:'条件式变位·si从句',done:false,
  learn:{grammar:{title:'条件式变位',rows:[
    ['人称','hablar','意思'],['yo','hablaría','我会说'],['tú','hablarías','你会说'],
    ['él/ella','hablaría','他/她会说'],['nosotros','hablaríamos','我们会说'],['ellos','hablarían','他们会说'],
  ]},
  note:'条件式=would。Si+过去虚拟,条件式=不可能条件。',
  vocab:[
    {es:'si tuviera…',zh:'如果我…',ex:'Si tuviera dinero, viajaría.'},{es:'me gustaría',zh:'我想要',ex:'Me gustaría aprender chino.'},
    {es:'podría',zh:'能(假设)',ex:'¿Podrías ayudarme?'},{es:'debería',zh:'应该',ex:'Deberías descansar.'},
    {es:'a menos que + subj.',zh:'除非',ex:'Vendré a menos que esté enfermo.'},{es:'siempre y cuando',zh:'只要',ex:'Iré siempre y cuando tengas tiempo.'},
  ]},
  quiz:[
    {type:'choice',q:'"hablaría"是什么时态？',options:['过去时','将来时','条件式','虚拟式'],answer:2,explain:'条件式=would'},
    {type:'fill',q:'"me gustaría"意思是？',answer:'我想要',explain:'me gustaría=我想要'},
    {type:'choice',q:'"Si tuviera dinero, ___"后半句？',options:['compro','compraría','compré','voy a comprar'],answer:1,explain:'Si+虚拟,条件式'},
    {type:'fill',q:'"你应该休息"：__ descansar.',answer:'deberías',explain:'debería=应该'},
    {type:'choice',q:'"a menos que"后面跟？',options:['直陈式','不定式','虚拟式','条件式'],answer:2,explain:'a menos que+虚拟式'},
  ]
},
{ id:'b1-3',name:'虚拟式不规则',icon:'🌀',desc:'ser/estar/ir/saber/haber/dar',done:false,
  learn:{grammar:{title:'虚拟式不规则变位',rows:[
    ['动词','直陈式yo','虚拟式yo','意思'],['ser','soy','sea','是'],['estar','estoy','esté','在'],
    ['ir','voy','vaya','去'],['saber','sé','sepa','知道'],['dar','doy','dé','给'],['haber','he','haya','有'],
  ]},
  vocab:[
    {es:'es posible que + sea',zh:'可能是…',ex:'Es posible que sea verdad.'},{es:'dudo que + sepa',zh:'我怀疑…',ex:'Dudo que sepa la respuesta.'},
    {es:'no quiero que + vaya',zh:'我不想让他去',ex:'No quiero que vayas.'},{es:'es necesario que + esté',zh:'有必要…',ex:'Es necesario que estés aquí.'},
  ]},
  quiz:[
    {type:'fill',q:'"ser"的虚拟式yo是？',answer:'sea',explain:'ser→sea'},{type:'fill',q:'"ir"的虚拟式yo是？',answer:'vaya',explain:'ir→vaya'},
    {type:'fill',q:'"saber"的虚拟式yo是？',answer:'sepa',explain:'saber→sepa'},
    {type:'choice',q:'"Dudo que ___"后跟？',options:['直陈式','不定式','虚拟式','将来时'],answer:2,explain:'dudar que+虚拟式'},
    {type:'fill',q:'"haber"的虚拟式yo是？',answer:'haya',explain:'haber→haya'},
  ]
},
{ id:'b1-4',name:'关系代词',icon:'🔗',desc:'que·quien·donde·cual·cuyo',done:false,
  learn:{grammar:{title:'关系代词',rows:[
    ['代词','用法','例句'],['que','人/物(最常用)','El libro que leí es bueno.'],
    ['quien','只有人','La chica de quien hablo es Ana.'],['donde','地点','La ciudad donde vivo es bonita.'],
    ['cuyo','所属(谁的)','El alumno cuyo nombre es Pedro.'],
  ]},
  vocab:[
    {es:'algo que',zh:'…的东西',ex:'Hay algo que necesito decirte.'},{es:'nada que',zh:'没有什么…',ex:'No hay nada que hacer.'},
    {es:'todo lo que',zh:'所有…的',ex:'Todo lo que dijiste es cierto.'},{es:'el lugar donde',zh:'…的地方',ex:'El lugar donde nací.'},
    {es:'la razón por la que',zh:'…的原因',ex:'La razón por la que vine.'},{es:'el día en que',zh:'…的那天',ex:'El día en que llegué.'},
  ]},
  quiz:[
    {type:'choice',q:'"que"可以指代人还是物？',options:['只有人','只有物','人/物都可以','只有地点'],answer:2,explain:'que最通用'},
    {type:'fill',q:'"我住的城市"：La ciudad __ vivo.',answer:'donde',explain:'donde=地点关系代词'},
    {type:'choice',q:'"cuyo"的意思是？',options:['谁','哪个','谁的','什么时候'],answer:2,explain:'cuyo=所属(谁的)'},
    {type:'fill',q:'"所有你说的"：Todo __ dijiste.',answer:'lo que',explain:'todo lo que'},
    {type:'choice',q:'"quien"只能指代？',options:['物','人','地点','时间'],answer:1,explain:'quien只能指人'},
  ]
},
{ id:'b1-5',name:'现在完成时',icon:'✅',desc:'Pretérito Perfecto·经历·结果',done:false,
  learn:{grammar:{title:'现在完成时(haber + 过去分词)',rows:[
    ['人称','hablar','comer','vivir'],['yo','he hablado','he comido','he vivido'],
    ['tú','has hablado','has comido','has vivido'],['él/ella','ha hablado','ha comido','ha vivido'],
    ['nosotros','hemos hablado','hemos comido','hemos vivido'],['ellos','han hablado','han comido','han vivido'],
  ]},
  note:'表示与现在有联系的过去经历或结果。常与ya, todavía no, nunca, alguna vez搭配。',
  vocab:[
    {es:'ya',zh:'已经',ex:'Ya he terminado.'},{es:'todavía no',zh:'还没',ex:'Todavía no he comido.'},
    {es:'nunca',zh:'从不',ex:'Nunca he ido a España.'},{es:'alguna vez',zh:'曾经',ex:'¿Has ido alguna vez a Madrid?'},
    {es:'acabar de + inf.',zh:'刚刚…',ex:'Acabo de llegar.'},{es:'llevar + gerundio',zh:'已经…了',ex:'Llevo tres años estudiando.'},
  ]},
  quiz:[
    {type:'fill',q:'"hablar"的yo现在完成时是？',answer:'he hablado',explain:'he+hablado'},
    {type:'choice',q:'"¿Has ido alguna vez a España?"意思是？',options:['你去过吗？','你去吗？','你去了吗？','你何时去？'],answer:0,explain:'haber ido=去过'},
    {type:'fill',q:'"我已经吃过了"：Ya __ comido.',answer:'he',explain:'ya he comido'},
    {type:'choice',q:'"Acabo de llegar"意思是？',options:['我到达了很久','我刚刚到','我要到达','我到达不了'],answer:1,explain:'acabar de+inf.=刚刚…'},
    {type:'fill',q:'"我学了三年西语"：Llevo tres años __ español.',answer:'estudiando',explain:'llevar+gerundio'},
  ]
},
{ id:'b1-6',name:'连接词与写作基础',icon:'📝',desc:'连词·转折因果递进',done:false,
  learn:{grammar:{title:'常用连接词',rows:[
    ['类型','连接词','例句'],['因果','porque','Llegué tarde porque había tráfico.'],
    ['转折','pero / sin embargo','Estudio mucho, pero no apruebo.'],['递进','además','Es caro; además, no es bonito.'],
    ['让步','aunque','Aunque llueve, iré.'],['目的','para que + subj.','Estudio para que mi familia esté orgullosa.'],
  ]},
  vocab:[
    {es:'por lo tanto',zh:'因此',ex:'Llovía, por lo tanto, no salí.'},{es:'en cambio',zh:'相反',ex:'Él trabaja; en cambio, yo descanso.'},
    {es:'además de',zh:'除了…还',ex:'Además de estudiar, trabajo.'},{es:'debido a',zh:'由于',ex:'Debido a la lluvia, no salí.'},
    {es:'gracias a',zh:'多亏了',ex:'Gracias a ti, lo conseguí.'},{es:'ya que',zh:'既然',ex:'Ya que estás aquí, ayúdame.'},
  ]},
  quiz:[
    {type:'choice',q:'"sin embargo"的意思？',options:['因为','然而','所以','而且'],answer:1,explain:'sin embargo=然而'},
    {type:'fill',q:'"因此"用西语？',answer:'por lo tanto',explain:'por lo tanto=因此'},
    {type:'choice',q:'"ya que"表示？',options:['转折','递进','因果(既然)','让步'],answer:2,explain:'ya que=既然'},
    {type:'fill',q:'"由于"用西语？',answer:'debido a',explain:'debido a=由于'},
    {type:'choice',q:'"además de"的意思？',options:['然而','由于','除了…还','因此'],answer:2,explain:'además de=除了…还'},
  ]
},
{ id:'b1-7',name:'过去完成时',icon:'⏪',desc:'Pluscuamperfecto·had done',done:false,
  learn:{grammar:{title:'过去完成时(haber过去未完成时+过去分词)',rows:[
    ['人称','hablar','comer','vivir'],['yo','había hablado','había comido','había vivido'],
    ['tú','habías hablado','habías comido','habías vivido'],['él/ella','había hablado','había comido','había vivido'],
    ['nosotros','habíamos hablado','habíamos comido','habíamos vivido'],['ellos','habían hablado','habían comido','habían vivido'],
  ]},
  note:'had done，表示过去某动作之前已完成的动作。',
  vocab:[
    {es:'cuando llegué, ya…',zh:'当我到达时已经…',ex:'Cuando llegué, ya se había ido.'},{es:'antes de que',zh:'在…之前',ex:'Antes de que llegaras, yo ya había comido.'},
    {es:'nunca había… hasta',zh:'直到…才第一次…',ex:'Nunca había viajado hasta el año pasado.'},{es:'todavía no había…',zh:'那时还没…',ex:'Todavía no había llegado.'},
  ]},
  quiz:[
    {type:'fill',q:'"hablar"的yo过去完成时是？',answer:'había hablado',explain:'había+hablado'},
    {type:'choice',q:'过去完成时表示什么？',options:['将来要做的','过去某时之前已完成的','现在的习惯','命令'],answer:1,explain:'had done'},
    {type:'fill',q:'"comer"的nosotros过去完成时是？',answer:'habíamos comido',explain:'habíamos+comido'},
    {type:'choice',q:'"Cuando llegué, ya se había ido"意思是？',options:['我到时他还没走','我到时他已经走了','我们同时到','他等我到'],answer:1,explain:'ya+过去完成时=已经…了'},
    {type:'fill',q:'"vivir"的ellos过去完成时是？',answer:'habían vivido',explain:'habían+vivido'},
  ]
},
{ id:'b1-8',name:'被动语态',icon:'🔄',desc:'ser+过去分词·por',done:false,
  learn:{grammar:{title:'被动语态(ser + 过去分词)',rows:[
    ['时态','例句','意思'],['现在时','El libro es escrito por él.','书是他写的。'],
    ['过去时','La casa fue construida en 1990.','房子建于1990年。'],['现在完成时','El proyecto ha sido terminado.','项目已经完成。'],
  ]},
  note:'ser+过去分词构成被动。过去分词要和名词保持性数一致。',
  vocab:[
    {es:'ser construido/a',zh:'被建',ex:'El puente fue construido en 1900.'},{es:'ser hecho/a',zh:'被做',ex:'Es hecho a mano.'},
    {es:'ser descubierto/a',zh:'被发现',ex:'América fue descubierta en 1492.'},{es:'ser hablado/a',zh:'被说',ex:'El español es hablado en muchos países.'},
    {es:'por + 人',zh:'被(某人)',ex:'Escrito por Cervantes.'},{es:'se + 第三人称',zh:'无人称被动',ex:'Se habla español aquí.'},
  ]},
  quiz:[
    {type:'choice',q:'被动语态用什么动词？',options:['estar','ser','haber','tener'],answer:1,explain:'ser+过去分词=被动'},
    {type:'choice',q:'"Se habla español aquí"是什么结构？',options:['反身','无人称被动','虚拟式','命令'],answer:1,explain:'se+第三单数=无人称被动'},
    {type:'fill',q:'"América fue descubierta __ 1492."空格？',answer:'en',explain:'en+年份'},
    {type:'choice',q:'"por"在被动句中表示什么？',options:['原因','为了','被(执行者)','通过'],answer:2,explain:'por+人=被某人做'},
    {type:'fill',q:'"书是他写的"：El libro __ escrito __ él.',answer:'es por',explain:'ser+过去分词+por+人'},
  ]
},
]};
