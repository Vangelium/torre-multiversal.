# Pruebas de guardado en la nube (beta)

Abren el juego real en Chromium y simulan dos celulares con la misma cuenta.
La nube es una imitación local de Supabase con sus reglas reales: cada cuenta
solo ve lo suyo, la revisión sube de 1 en 1 y `verified` siempre es falso.
No tocan el Supabase real ni el juego oficial.

    pip install playwright && python -m playwright install chromium
    cd tests/beta-sync && python test_dos_celulares.py 8770

Cubre: guardado al entrar, al pausar y al minimizar; abrir en otro celular el
progreso exacto; aviso de versión más nueva; «Recuperar nube»; celular
encendido sin jugar que no sube versiones; conflicto sin sobrescritura; sin
internet y reintento; pausa voluntaria; juego oficial intacto.

Limitación: no reemplaza la prueba con dos celulares reales contra el Supabase real.
