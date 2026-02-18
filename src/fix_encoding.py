#!/usr/bin/env python3
"""Fix mojibake encoding (ï¿½) in Resumen_Agrupado.json.

The literal string 'ï¿½' represents a lost accented character (U+FFFD replacement).
This script maps each broken word to its correct Spanish equivalent.
"""
import json

# Comprehensive mapping: broken_word → correct_word
# Organized by the replacement character (Ó, Í, Ñ, É, Á, Ú, etc.)
REPLACEMENTS = {
    # === Double replacement ===
    "COMPAï¿½ï¿½A": "COMPAÑÍA",

    # === Ñ replacements ===
    "ACOMPAï¿½AMIENTO": "ACOMPAÑAMIENTO",
    "AQUIï¿½O": "AQUIÑO",
    "Aï¿½OS": "AÑOS",
    "BREï¿½A": "BREÑA",
    "BRICEï¿½O": "BRICEÑO",
    "CASTAï¿½EDA": "CASTAÑEDA",
    "CAï¿½ETE": "CAÑETE",
    "COMPAï¿½IA": "COMPAÑIA",
    "CUSQUEï¿½A": "CUSQUEÑA",
    "DAï¿½OS": "DAÑOS",
    "ENGAï¿½OSA": "ENGAÑOSA",
    "ESPAï¿½A": "ESPAÑA",
    "ESPAï¿½OLA": "ESPAÑOLA",
    "Enseï¿½anza": "Enseñanza",
    "FARIï¿½A": "FARIÑA",
    "IBAï¿½EZ": "IBAÑEZ",
    "MAGUIï¿½A": "MAGUIÑA",
    "MIï¿½ANO": "MIÑANO",
    "MUï¿½OZ": "MUÑOZ",
    "NIï¿½O": "NIÑO",
    "NIï¿½OS": "NIÑOS",
    "NUï¿½EZ": "NUÑEZ",
    "PEï¿½A": "PEÑA",
    "PEï¿½ARAN": "PEÑARAN",
    "PUTPAï¿½A": "PUTPAÑA",
    "QUIï¿½ONES": "QUIÑONES",
    "RIBEREï¿½OS": "RIBEREÑOS",
    "ROMAï¿½A": "ROMAÑA",
    "RUBIï¿½OS": "RUBIÑOS",
    "SALDAï¿½A": "SALDAÑA",
    "SEï¿½ORA": "SEÑORA",
    "VICUï¿½A": "VICUÑA",
    "VIï¿½EDOS": "VIÑEDOS",
    "ZAï¿½A": "ZAÑA",
    "Peï¿½": "Peñ",

    # === Ó replacements (includes all -CIÓN/-SIÓN patterns) ===
    "ACCIï¿½N": "ACCIÓN",
    "ACOTACIï¿½N": "ACOTACIÓN",
    "ACTUALIZACIï¿½N": "ACTUALIZACIÓN",
    "ADECUACIï¿½N": "ADECUACIÓN",
    "ADJUDICACIï¿½N": "ADJUDICACIÓN",
    "ADQUISICIï¿½N": "ADQUISICIÓN",
    "ALARCï¿½N": "ALARCÓN",
    "ANULACIï¿½N": "ANULACIÓN",
    "ANï¿½NIMA": "ANÓNIMA",
    "ASIGNACIï¿½N": "ASIGNACIÓN",
    "ASOCIACIï¿½N": "ASOCIACIÓN",
    "AUTORIZACIï¿½N": "AUTORIZACIÓN",
    "Acciï¿½n": "Acción",
    "Actualizaciï¿½n": "Actualización",
    "CALDERï¿½N": "CALDERÓN",
    "CAPACITACIï¿½N": "CAPACITACIÓN",
    "CASACIï¿½N": "CASACIÓN",
    "COLEGIACIï¿½N": "COLEGIACIÓN",
    "CONCESIï¿½N": "CONCESIÓN",
    "CONEXIï¿½N": "CONEXIÓN",
    "CONFIRMACIï¿½N": "CONFIRMACIÓN",
    "CONSTATACIï¿½N": "CONSTATACIÓN",
    "CONSTITUCIï¿½N": "CONSTITUCIÓN",
    "CORPORACIï¿½N": "CORPORACIÓN",
    "Concesiï¿½n": "Concesión",
    "Conservaciï¿½n": "Conservación",
    "Construcciï¿½n": "Construcción",
    "Contrataciï¿½n": "Contratación",
    "Cï¿½digo": "Código",
    "DESCENTRALIZACIï¿½N": "DESCENTRALIZACIÓN",
    "DESVINCULACIï¿½N": "DESVINCULACIÓN",
    "DEVOLUCIï¿½N": "DEVOLUCIÓN",
    "DISCRIMINACIï¿½N": "DISCRIMINACIÓN",
    "Depï¿½sito": "Depósito",
    "Distribuciï¿½n": "Distribución",
    "ECONï¿½MICO": "ECONÓMICO",
    "EDIFICACIï¿½N": "EDIFICACIÓN",
    "EDUCACIï¿½N": "EDUCACIÓN",
    "EJECUCIï¿½N": "EJECUCIÓN",
    "ELABORACIï¿½N": "ELABORACIÓN",
    "Educaciï¿½n": "Educación",
    "Elaboraciï¿½n": "Elaboración",
    "Explotaciï¿½n": "Explotación",
    "Extracciï¿½n": "Extracción",
    "EXONERACIï¿½N": "EXONERACIÓN",
    "EXPEDICIï¿½N": "EXPEDICIÓN",
    "EXTINCIï¿½N": "EXTINCIÓN",
    "Fabricaciï¿½n": "Fabricación",
    "FEDERACIï¿½N": "FEDERACIÓN",
    "FISCALIZACIï¿½N": "FISCALIZACIÓN",
    "Fiscalizaciï¿½n": "Fiscalización",
    "FUNDACIï¿½N": "FUNDACIÓN",
    "GENERACIï¿½N": "GENERACIÓN",
    "Generaciï¿½n": "Generación",
    "Gestiï¿½n": "Gestión",
    "HABILITACIï¿½N": "HABILITACIÓN",
    "HELICï¿½PTEROS": "HELICÓPTEROS",
    "HOMOLOGACIï¿½N": "HOMOLOGACIÓN",
    "IMPUGNACIï¿½N": "IMPUGNACIÓN",
    "INCLUSIï¿½N": "INCLUSIÓN",
    "INDEMNIZACIï¿½N": "INDEMNIZACIÓN",
    "INDEPENDIZACIï¿½N": "INDEPENDIZACIÓN",
    "INFORMACIï¿½N": "INFORMACIÓN",
    "Informaciï¿½n": "Información",
    "INSCRIPCIï¿½N": "INSCRIPCIÓN",
    "INSTALACIï¿½N": "INSTALACIÓN",
    "INTERVENCIï¿½N": "INTERVENCIÓN",
    "Intermediaciï¿½n": "Intermediación",
    "INVESTIGACIï¿½N": "INVESTIGACIÓN",
    "Investigaciï¿½n": "Investigación",
    "Inversiï¿½n": "Inversión",
    "Japï¿½n": "Japón",
    "LEï¿½N": "LEÓN",
    "LICITACIï¿½N": "LICITACIÓN",
    "Licitaciï¿½n": "Licitación",
    "LIQUIDACIï¿½N": "LIQUIDACIÓN",
    "Lï¿½PEZ": "LÓPEZ",
    "LUBRICACIï¿½N": "LUBRICACIÓN",
    "MODIFICACIï¿½N": "MODIFICACIÓN",
    "NEGOCIACIï¿½N": "NEGOCIACIÓN",
    "OBTENCIï¿½N": "OBTENCIÓN",
    "Odontï¿½logos": "Odontólogos",
    "OPERACIï¿½N": "OPERACIÓN",
    "OPINIï¿½N": "OPINIÓN",
    "PARTICIPACIï¿½N": "PARTICIPACIÓN",
    "Petrï¿½leo": "Petróleo",
    "PRODUCCIï¿½N": "PRODUCCIÓN",
    "Programaciï¿½n": "Programación",
    "PROMOCIï¿½N": "PROMOCIÓN",
    "PROTECCIï¿½N": "PROTECCIÓN",
    "PRï¿½RROGA": "PRÓRROGA",
    "RECUPERACIï¿½N": "RECUPERACIÓN",
    "Reestructuraciï¿½n": "Reestructuración",
    "Refinaciï¿½n": "Refinación",
    "REGULARIZACIï¿½N": "REGULARIZACIÓN",
    "REINVERSIï¿½N": "REINVERSIÓN",
    "REIVINDICACIï¿½N": "REIVINDICACIÓN",
    "RENOVACIï¿½N": "RENOVACIÓN",
    "REPOSICIï¿½N": "REPOSICIÓN",
    "RESOLUCIï¿½N": "RESOLUCIÓN",
    "Retribuciï¿½n": "Retribución",
    "REVERSIï¿½N": "REVERSIÓN",
    "REVISIï¿½N": "REVISIÓN",
    "SUCESIï¿½N": "SUCESIÓN",
    "SUNCIï¿½N": "SUNCIÓN",
    "SUPERPOSICIï¿½N": "SUPERPOSICIÓN",
    "SUPERVISIï¿½N": "SUPERVISIÓN",
    "Sï¿½lidos": "Sólidos",
    "TELEFï¿½NICA": "TELEFÓNICA",
    "Telecomunicaciï¿½n": "Telecomunicación",
    "Televisiï¿½n": "Televisión",
    "TERCERIZACIï¿½N": "TERCERIZACIÓN",
    "TRANSACCIï¿½N": "TRANSACCIÓN",
    "Transmisiï¿½n": "Transmisión",
    "VERSIï¿½N": "VERSIÓN",
    "VERï¿½NICA": "VERÓNICA",
    "VISIï¿½N": "VISIÓN",
    "ZONIFICACIï¿½N": "ZONIFICACIÓN",
    "determinaciï¿½n": "determinación",
    "inversiï¿½n": "inversión",
    "prescripciï¿½n": "prescripción",
    "ADï¿½PTAMIU": "ADÓPTAMIU",
    "TECNOLï¿½GICO": "TECNOLÓGICO",

    # === Í replacements ===
    "AGRï¿½COLAS": "AGRÍCOLAS",
    "AMNISTï¿½A": "AMNISTÍA",
    "Artï¿½culos": "Artículos",
    "ASESORï¿½A": "ASESORÍA",
    "Asesorï¿½a": "Asesoría",
    "AUDITORï¿½A": "AUDITORÍA",
    "Auditorï¿½a": "Auditoría",
    "CERVECERï¿½AS": "CERVECERÍAS",
    "Cientï¿½ficas": "Científicas",
    "CONSULTORï¿½A": "CONSULTORÍA",
    "Consultorï¿½a": "Consultoría",
    "CRï¿½TICOS": "CRÍTICOS",
    "DESAFï¿½O": "DESAFÍO",
    "Dï¿½AZ": "DÍAZ",
    "ECONOMï¿½A": "ECONOMÍA",
    "ENERGï¿½A": "ENERGÍA",
    "Energï¿½a": "Energía",
    "GARANTï¿½A": "GARANTÍA",
    "GARANTï¿½AS": "GARANTÍAS",
    "GARCï¿½A": "GARCÍA",
    "Ingenierï¿½a": "Ingeniería",
    "JURï¿½DICA": "JURÍDICA",
    "JURï¿½DICO": "JURÍDICO",
    "Jurï¿½dicas": "Jurídicas",
    "Lï¿½quidos": "Líquidos",
    "MALTERï¿½A": "MALTERÍA",
    "MARTï¿½N": "MARTÍN",
    "MARï¿½A": "MARÍA",
    "MINERï¿½A": "MINERÍA",
    "Marï¿½tima": "Marítima",
    "Marï¿½timo": "Marítimo",
    "Metalï¿½feros": "Metalíferos",
    "Minerï¿½a": "Minería",
    "Pesquerï¿½a": "Pesquería",
    "POLï¿½TICA": "POLÍTICA",
    "PROVï¿½AS": "PROVÍAS",
    "RODRï¿½GUEZ": "RODRÍGUEZ",
    "SUMARï¿½SIMO": "SUMARÍSIMO",
    "TECNOLOGï¿½A": "TECNOLOGÍA",
    "Tecnologï¿½a": "Tecnología",
    "Tenedurï¿½a": "Teneduría",
    "TUBERï¿½A": "TUBERÍA",
    "Tuberï¿½as": "Tuberías",
    "URBANï¿½STICOS": "URBANÍSTICOS",
    "Vehï¿½culos": "Vehículos",
    "Vï¿½A": "VÍA",
    "ï¿½NDIGO": "ÍNDIGO",

    # === É replacements ===
    "AMï¿½RICAS": "AMÉRICAS",
    "Aï¿½reo": "Aéreo",
    "BARTOLOMï¿½": "BARTOLOMÉ",
    "CORTï¿½S": "CORTÉS",
    "Cosmï¿½ticos": "Cosméticos",
    "Crï¿½dito": "Crédito",
    "CRï¿½DITOS": "CRÉDITOS",
    "Domï¿½sticos": "Domésticos",
    "ELï¿½CTRICO": "ELÉCTRICO",
    "Elï¿½ctrica": "Eléctrica",
    "Farmacï¿½uticos": "Farmacéuticos",
    "GARCï¿½S": "GARCÉS",
    "Hï¿½ROES": "HÉROES",
    "JOSUï¿½": "JOSUÉ",
    "JOSï¿½": "JOSÉ",
    "Mï¿½dicos": "Médicos",
    "Mï¿½xico": "México",
    "Perifï¿½rico": "Periférico",
    "Pï¿½RDIDAS": "PÉRDIDAS",
    "Pï¿½REZ": "PÉREZ",
    "Rï¿½GIMEN": "RÉGIMEN",
    "Satï¿½lite": "Satélite",
    "Tï¿½cnica": "Técnica",
    "Tï¿½cnicas": "Técnicas",

    # === Á replacements ===
    "ANï¿½LISIS": "ANÁLISIS",
    "Alï¿½mbricas": "Alámbricas",
    "ARMENDï¿½RIZ": "ARMENDÁRIZ",
    "CLï¿½USULAS": "CLÁUSULAS",
    "Cï¿½MARA": "CÁMARA",
    "Fï¿½BRICA": "FÁBRICA",
    "GRï¿½FICAS": "GRÁFICAS",
    "GUZMï¿½N": "GUZMÁN",
    "Informï¿½ticos": "Informáticos",
    "MARIï¿½TEGUI": "MARIÁTEGUI",
    "Plï¿½stico": "Plástico",
    "Pï¿½blica": "Pública",
    "Rï¿½PIDO": "RÁPIDO",
    "SEBASTIï¿½N": "SEBASTIÁN",
    "TRï¿½MITE": "TRÁMITE",
    "TRï¿½NSITO": "TRÁNSITO",
    "TUMIALï¿½N": "TUMIALÁN",
    "VELï¿½SQUEZ": "VELÁSQUEZ",
    "ï¿½RBITROS": "ÁRBITROS",
    "ï¿½REAS": "ÁREAS",
    "ï¿½VILA": "ÁVILA",
    "ï¿½rboles": "Árboles",
    "CHUMï¿½N": "CHUMÁN",

    # === Ú replacements ===
    "AZï¿½CAR": "AZÚCAR",
    "FIDUPERï¿½": "FIDUPERÚ",
    "JESï¿½S": "JESÚS",
    "PERï¿½": "PERÚ",
    "Perï¿½": "Perú",

    # === Ü replacements ===
    "Hï¿½BNER": "HÜBNER",

    # === Missed entries ===
    "PREPARACIï¿½N": "PREPARACIÓN",
    "PRESCRIPCIï¿½N": "PRESCRIPCIÓN",
    "Quï¿½micos": "Químicos",
    "UNIï¿½N": "UNIÓN",

    # === ° (degree symbol) ===
    "Nï¿½140": "N°140",
}


def main():
    with open("Resumen_Agrupado.json", "r", encoding="utf-8") as f:
        text = f.read()

    target = "ï¿½"
    before_count = text.count(target)
    print(f"Mojibake occurrences before: {before_count}")

    # Sort replacements by length (longest first) to avoid partial matches
    sorted_replacements = sorted(REPLACEMENTS.items(), key=lambda x: -len(x[0]))

    for broken, fixed in sorted_replacements:
        text = text.replace(broken, fixed)

    after_count = text.count(target)
    print(f"Mojibake occurrences after:  {after_count}")

    if after_count > 0:
        # Find remaining broken words
        import re
        pattern = re.compile(r'[\w\u00bf\u00bd\u00ef]+')
        remaining = set()
        for m in pattern.finditer(text):
            w = m.group()
            if target in w:
                remaining.add(w)
        print(f"\nRemaining unfixed words ({len(remaining)}):")
        for w in sorted(remaining):
            print(f"  {w}")

    # Validate JSON
    try:
        data = json.loads(text)
        print(f"\nJSON valid: {len(data)} records")
    except json.JSONDecodeError as e:
        print(f"\nJSON ERROR: {e}")
        return

    # Write back
    with open("Resumen_Agrupado.json", "w", encoding="utf-8") as f:
        f.write(text)

    print("Done! File updated.")


if __name__ == "__main__":
    main()
