export const translations = {
    es: {
        hero: {
            headlinePrefix: "Escala con ",
            headlineHighlight: "Sistemas de IA",
            subtext: "Descubre tus cuellos de botella, despliega sistemas de alto retorno y convierte demanda en resultados con infraestructura digital.",
            ctaPrimary: "Comenzar el Proceso",
            ctaSecondary: "Agendar Llamada"
        },
        identification: {
            headline: "Escalar sin sistemas crea inestabilidad",
            subheadline: "Si esto te suena familiar, tu negocio está listo para automatización estructurada.",
            bullets: [
                "Llegan leads, pero el seguimiento no es consistente",
                "Tu equipo está saturado con tareas repetitivas",
                "Procesos importantes dependen de memoria, no de estructura",
                "El crecimiento aumenta la complejidad, no la claridad",
                "No tienes visibilidad operativa en tiempo real",
                "Estás contratando para corregir ineficiencias"
            ]
        },
        layers: {
            title: "Diseñamos sistemas de negocio en tres capas",
            subtext: "Cada capa se conecta para que tu operación funcione con claridad — no como servicios separados.",
            cards: [
                {
                    title: "Capa de Automatización",
                    text: "Automatizamos seguimiento, tareas y flujos repetitivos para aumentar velocidad y consistencia."
                },
                {
                    title: "Capa de Infraestructura",
                    text: "Tu website y tus procesos internos trabajan como un solo sistema, en lugar de operar individualmente."
                },
                {
                    title: "Capa de Visibilidad Operacional",
                    text: "Monitorea el estado de tus procesos y toma decisiones con datos, no suposiciones."
                }
            ],
            diagram: {
                automation: "Capa de Automatización",
                infrastructure: "Capa de Infraestructura",
                visibility: "Capa de Visibilidad"
            }
        },
        scale: {
            headline: "Escala sin aumentar tu nómina",
            subheadline: "Aumenta capacidad, mejora tiempos de respuesta y convierte más oportunidades — sin presión de payroll.",
            cards: [
                {
                    title: "Automatiza la repetición",
                    text: "Elimina seguimientos manuales y cuellos de botella administrativos."
                },
                {
                    title: "Estandariza la ejecución",
                    text: "Cambia procesos basados en memoria por flujos estructurados."
                },
                {
                    title: "Centraliza la visibilidad",
                    text: "Sabe qué está pasando dentro del negocio, en todo momento."
                }
            ]
        },
        howItWorks: {
            headline: "Cómo desplegamos tu sistema",
            subtext: "Un proceso estructurado diseñado para negocios en crecimiento y firmas profesionales.",
            steps: [
                { title: "Diagnóstico de Gaps Operacionales", desc: "Identificamos oportunidades y brechas." }, // Simplified desc for layout if needed, or stick to provided? User didn't provide desc for ES steps in prompt list, only titles.  WAIT. User provided titles only for steps in prompt Section 5. Let's infer or use placeholder if not strictly valid. Use just titles if that's what was asked.  Actually, looking at Section 5 ES: "Steps: 1) ... 2) ...".  The EN section also just lists steps.  However, the current HTML has descriptions. I will assume we should keep descriptions but maybe I don't have the translation for them? I will use generic or leave English for now? No, user said "BILINGUAL REQUIREMENT". I will improvise minimal descriptions based on context or just use the titles if the design allows.  Actually, let's look at the implementation plan again.  "Steps: 1) Diagnóstico...".  I'll add descriptions matching the intent.
                { title: "Diseño de Arquitectura", desc: "Creamos el plano de tu infraestructura digital." },
                { title: "Implementación e Integración", desc: "Construimos y conectamos tus sistemas." },
                { title: "Optimización y Escala", desc: "Mejoramos el rendimiento continuamente." }
            ]
        },
        differentiation: {
            headline: "No es marketing. Es infraestructura.",
            subheadline: "No corremos anuncios. Diseñamos el sistema que convierte la demanda que ya generas.",
            points: [
                "Centralizamos herramientas fragmentadas",
                "Estandarizamos flujos operacionales",
                "Conectamos leads con ejecución",
                "Construimos arquitectura digital escalable"
            ]
        },
        startProcess: {
            headline: "Comienza con un diagnóstico rápido",
            subtext: "Identificamos oportunidades, definimos el sistema y te damos un plan claro de despliegue."
        },
        bookCall: {
            headline: "Agenda tu llamada",
            subtext: "Deja de perder oportunidades. Comienza a escalar con estructura."
        }
    },
    en: {
        hero: {
            headlinePrefix: "Scale with ",
            headlineHighlight: "AI Systems",
            subtext: "Discover your bottlenecks, deploy high ROI systems, and convert demand into results with structured digital infrastructure.",
            ctaPrimary: "Start the Process",
            ctaSecondary: "Book the Call"
        },
        identification: {
            headline: "Scaling Without Systems Creates Instability",
            subheadline: "If any of these sound familiar, your business is ready for structured automation.",
            bullets: [
                "Leads are coming in — but follow-ups aren’t consistent",
                "Your team is overwhelmed with repetitive tasks",
                "Important processes depend on memory instead of structure",
                "Growth is increasing complexity instead of clarity",
                "You don’t have real-time operational visibility",
                "You’re hiring to fix inefficiencies"
            ]
        },
        layers: {
            title: "We design business systems across three core layers",
            subtext: "Each layer connects so your operation runs with clarity — not as separate services.",
            cards: [
                {
                    title: "Automation Layer",
                    text: "We automate follow-ups, tasks, and repetitive workflows to increase speed and consistency."
                },
                {
                    title: "Infrastructure Layer",
                    text: "Your website system and internal processes work together instead of operating individually."
                },
                {
                    title: "Operational Visibility Layer",
                    text: "Monitor what’s happening and make decisions with data — not guesses."
                }
            ],
            diagram: {
                automation: "Automation Layer",
                infrastructure: "Infrastructure Layer",
                visibility: "Visibility Layer"
            }
        },
        scale: {
            headline: "Scale Without Expanding Your Team",
            subheadline: "Increase capacity, improve response times, and convert more opportunities — without increasing payroll pressure.",
            cards: [
                {
                    title: "Automate Repetition",
                    text: "Eliminate manual follow-ups and admin bottlenecks."
                },
                {
                    title: "Standardize Execution",
                    text: "Replace memory-based processes with structured workflows."
                },
                {
                    title: "Centralize Visibility",
                    text: "Know exactly what’s happening inside your business at all times."
                }
            ]
        },
        howItWorks: {
            headline: "How We Deploy Your System",
            subtext: "A structured deployment process built for growing businesses and professional firms.",
            steps: [
                { title: "Diagnose Operational Gaps", desc: "Identify operational gaps and bottlenecks in your current workflow." },
                { title: "Design the Architecture", desc: "Architect the custom system layers needed for your specific goals." },
                { title: "Implement & Integrate", desc: "Build, integrate, and deploy your new automation infrastructure." },
                { title: "Optimize & Scale", desc: "Refine performance and scale the system as you grow." }
            ]
        },
        differentiation: {
            headline: "Not Marketing. Infrastructure.",
            subheadline: "We don’t run ads. We design the system that converts the demand you already generate.",
            points: [
                "We centralize fragmented tools",
                "We standardize operational workflows",
                "We connect your lead flow to execution",
                "We build scalable digital architecture"
            ]
        },
        startProcess: {
            headline: "Start with a fast diagnosis",
            subtext: "We identify opportunities, define the system, and give you a clear deployment plan."
        },
        bookCall: {
            headline: "Book the Call",
            subtext: "Stop losing opportunities. Start scaling with structure."
        }
    }
};