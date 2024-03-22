/* empty css                          */
import { c as createAstro, d as createComponent, r as renderTemplate, e as addAttribute, f as renderHead, g as renderComponent, h as renderSlot } from '../astro_CPxtva9S.mjs';
import 'kleur/colors';
import 'html-escaper';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import clsx from 'clsx';
/* empty css                         */
import { createBox } from '@dessert-box/react';
import { createSprinkles } from '@vanilla-extract/sprinkles/createRuntimeSprinkles';
import '../blog.4fa3bb84_l0sNRNKZ.mjs';
import { createRuntimeFn } from '@vanilla-extract/recipes/createRuntimeFn';
/* empty css                         */
/* empty css                         */

var layoutStyles = '_1pv66rb0 _1bxxdn1ey _1bxxdn1f5 _1bxxdn1fc _1bxxdn1ba _1bxxdn1bc _1bxxdn1bb _1bxxdn197 _1bxxdn1ga';
var headerStyle = '_1pv66rb1 _1bxxdn16y _1bxxdn173 _1bxxdn172 _1bxxdn17g _1bxxdn17l _1bxxdn17k _1bxxdn17y _1bxxdn183 _1bxxdn182 _1bxxdn18g _1bxxdn18l _1bxxdn18k _1bxxdn12s _1bxxdn12u _1bxxdn12t _1bxxdn1cp _1bxxdn1cr _1bxxdn1cq _1bxxdn154 _1bxxdn156 _1bxxdn155 _1bxxdn14p _1bxxdn14r _1bxxdn14q _1bxxdn12a _1bxxdn12c _1bxxdn12b _1bxxdn13d _1bxxdn13f _1bxxdn13e _1bxxdn13p _1bxxdn13r _1bxxdn13q _1bxxdn1gc _1bxxdn13 _1bxxdn1dg _1bxxdn1dl _1bxxdn1dk';

var defaultTheme = '_2amt6t0';

var valerioSprinkles = createSprinkles({conditions:{defaultCondition:'desktop',conditionNames:['mobile','tablet','desktop'],responsiveArray:undefined},styles:{padding:{mappings:['paddingTop','paddingBottom','paddingLeft','paddingRight']},paddingX:{mappings:['paddingLeft','paddingRight']},paddingY:{mappings:['paddingTop','paddingBottom']},margin:{values:{none:{conditions:{mobile:'_1bxxdn1av',tablet:'_1bxxdn1aw',desktop:'_1bxxdn1ax'},defaultClass:'_1bxxdn1ax'},small:{conditions:{mobile:'_1bxxdn1ay',tablet:'_1bxxdn1az',desktop:'_1bxxdn1b0'},defaultClass:'_1bxxdn1b0'},medium:{conditions:{mobile:'_1bxxdn1b1',tablet:'_1bxxdn1b2',desktop:'_1bxxdn1b3'},defaultClass:'_1bxxdn1b3'},large:{conditions:{mobile:'_1bxxdn1b4',tablet:'_1bxxdn1b5',desktop:'_1bxxdn1b6'},defaultClass:'_1bxxdn1b6'},extraLarge:{conditions:{mobile:'_1bxxdn1b7',tablet:'_1bxxdn1b8',desktop:'_1bxxdn1b9'},defaultClass:'_1bxxdn1b9'},auto:{conditions:{mobile:'_1bxxdn1ba',tablet:'_1bxxdn1bb',desktop:'_1bxxdn1bc'},defaultClass:'_1bxxdn1bc'}}},marginX:{mappings:['marginLeft','marginRight']},marginY:{mappings:['marginTop','marginBottom']},display:{values:{flex:{conditions:{mobile:'_1bxxdn12a',tablet:'_1bxxdn12b',desktop:'_1bxxdn12c'},defaultClass:'_1bxxdn12c'},block:{conditions:{mobile:'_1bxxdn12d',tablet:'_1bxxdn12e',desktop:'_1bxxdn12f'},defaultClass:'_1bxxdn12f'},inline:{conditions:{mobile:'_1bxxdn12g',tablet:'_1bxxdn12h',desktop:'_1bxxdn12i'},defaultClass:'_1bxxdn12i'},inlineBlock:{conditions:{mobile:'_1bxxdn12j',tablet:'_1bxxdn12k',desktop:'_1bxxdn12l'},defaultClass:'_1bxxdn12l'},none:{conditions:{mobile:'_1bxxdn12m',tablet:'_1bxxdn12n',desktop:'_1bxxdn12o'},defaultClass:'_1bxxdn12o'},grid:{conditions:{mobile:'_1bxxdn12p',tablet:'_1bxxdn12q',desktop:'_1bxxdn12r'},defaultClass:'_1bxxdn12r'}}},position:{values:{fixed:{conditions:{mobile:'_1bxxdn12s',tablet:'_1bxxdn12t',desktop:'_1bxxdn12u'},defaultClass:'_1bxxdn12u'},absolute:{conditions:{mobile:'_1bxxdn12v',tablet:'_1bxxdn12w',desktop:'_1bxxdn12x'},defaultClass:'_1bxxdn12x'},relative:{conditions:{mobile:'_1bxxdn12y',tablet:'_1bxxdn12z',desktop:'_1bxxdn130'},defaultClass:'_1bxxdn130'},sticky:{conditions:{mobile:'_1bxxdn131',tablet:'_1bxxdn132',desktop:'_1bxxdn133'},defaultClass:'_1bxxdn133'},'static':{conditions:{mobile:'_1bxxdn134',tablet:'_1bxxdn135',desktop:'_1bxxdn136'},defaultClass:'_1bxxdn136'}}},justifyContent:{values:{'flex-start':{conditions:{mobile:'_1bxxdn137',tablet:'_1bxxdn138',desktop:'_1bxxdn139'},defaultClass:'_1bxxdn139'},'flex-end':{conditions:{mobile:'_1bxxdn13a',tablet:'_1bxxdn13b',desktop:'_1bxxdn13c'},defaultClass:'_1bxxdn13c'},center:{conditions:{mobile:'_1bxxdn13d',tablet:'_1bxxdn13e',desktop:'_1bxxdn13f'},defaultClass:'_1bxxdn13f'},'space-between':{conditions:{mobile:'_1bxxdn13g',tablet:'_1bxxdn13h',desktop:'_1bxxdn13i'},defaultClass:'_1bxxdn13i'}}},alignItems:{values:{'flex-start':{conditions:{mobile:'_1bxxdn13j',tablet:'_1bxxdn13k',desktop:'_1bxxdn13l'},defaultClass:'_1bxxdn13l'},'flex-end':{conditions:{mobile:'_1bxxdn13m',tablet:'_1bxxdn13n',desktop:'_1bxxdn13o'},defaultClass:'_1bxxdn13o'},center:{conditions:{mobile:'_1bxxdn13p',tablet:'_1bxxdn13q',desktop:'_1bxxdn13r'},defaultClass:'_1bxxdn13r'}}},flexDirection:{values:{row:{conditions:{mobile:'_1bxxdn13s',tablet:'_1bxxdn13t',desktop:'_1bxxdn13u'},defaultClass:'_1bxxdn13u'},column:{conditions:{mobile:'_1bxxdn13v',tablet:'_1bxxdn13w',desktop:'_1bxxdn13x'},defaultClass:'_1bxxdn13x'}}},'-webkit-text-stroke':{values:{small:{conditions:{mobile:'_1bxxdn13y',tablet:'_1bxxdn13z',desktop:'_1bxxdn140'},defaultClass:'_1bxxdn140'},medium:{conditions:{mobile:'_1bxxdn141',tablet:'_1bxxdn142',desktop:'_1bxxdn143'},defaultClass:'_1bxxdn143'},large:{conditions:{mobile:'_1bxxdn144',tablet:'_1bxxdn145',desktop:'_1bxxdn146'},defaultClass:'_1bxxdn146'}}},spaceBetween:{values:{none:{conditions:{mobile:'_1bxxdn147',tablet:'_1bxxdn148',desktop:'_1bxxdn149'},defaultClass:'_1bxxdn149'},small:{conditions:{mobile:'_1bxxdn14a',tablet:'_1bxxdn14b',desktop:'_1bxxdn14c'},defaultClass:'_1bxxdn14c'},medium:{conditions:{mobile:'_1bxxdn14d',tablet:'_1bxxdn14e',desktop:'_1bxxdn14f'},defaultClass:'_1bxxdn14f'},large:{conditions:{mobile:'_1bxxdn14g',tablet:'_1bxxdn14h',desktop:'_1bxxdn14i'},defaultClass:'_1bxxdn14i'},extraLarge:{conditions:{mobile:'_1bxxdn14j',tablet:'_1bxxdn14k',desktop:'_1bxxdn14l'},defaultClass:'_1bxxdn14l'},auto:{conditions:{mobile:'_1bxxdn14m',tablet:'_1bxxdn14n',desktop:'_1bxxdn14o'},defaultClass:'_1bxxdn14o'}}},top:{values:{zero:{conditions:{mobile:'_1bxxdn14p',tablet:'_1bxxdn14q',desktop:'_1bxxdn14r'},defaultClass:'_1bxxdn14r'},quarter:{conditions:{mobile:'_1bxxdn14s',tablet:'_1bxxdn14t',desktop:'_1bxxdn14u'},defaultClass:'_1bxxdn14u'},half:{conditions:{mobile:'_1bxxdn14v',tablet:'_1bxxdn14w',desktop:'_1bxxdn14x'},defaultClass:'_1bxxdn14x'},third:{conditions:{mobile:'_1bxxdn14y',tablet:'_1bxxdn14z',desktop:'_1bxxdn150'},defaultClass:'_1bxxdn150'},full:{conditions:{mobile:'_1bxxdn151',tablet:'_1bxxdn152',desktop:'_1bxxdn153'},defaultClass:'_1bxxdn153'}}},left:{values:{zero:{conditions:{mobile:'_1bxxdn154',tablet:'_1bxxdn155',desktop:'_1bxxdn156'},defaultClass:'_1bxxdn156'},quarter:{conditions:{mobile:'_1bxxdn157',tablet:'_1bxxdn158',desktop:'_1bxxdn159'},defaultClass:'_1bxxdn159'},half:{conditions:{mobile:'_1bxxdn15a',tablet:'_1bxxdn15b',desktop:'_1bxxdn15c'},defaultClass:'_1bxxdn15c'},third:{conditions:{mobile:'_1bxxdn15d',tablet:'_1bxxdn15e',desktop:'_1bxxdn15f'},defaultClass:'_1bxxdn15f'},full:{conditions:{mobile:'_1bxxdn15g',tablet:'_1bxxdn15h',desktop:'_1bxxdn15i'},defaultClass:'_1bxxdn15i'}}},right:{values:{zero:{conditions:{mobile:'_1bxxdn15j',tablet:'_1bxxdn15k',desktop:'_1bxxdn15l'},defaultClass:'_1bxxdn15l'},quarter:{conditions:{mobile:'_1bxxdn15m',tablet:'_1bxxdn15n',desktop:'_1bxxdn15o'},defaultClass:'_1bxxdn15o'},half:{conditions:{mobile:'_1bxxdn15p',tablet:'_1bxxdn15q',desktop:'_1bxxdn15r'},defaultClass:'_1bxxdn15r'},third:{conditions:{mobile:'_1bxxdn15s',tablet:'_1bxxdn15t',desktop:'_1bxxdn15u'},defaultClass:'_1bxxdn15u'},full:{conditions:{mobile:'_1bxxdn15v',tablet:'_1bxxdn15w',desktop:'_1bxxdn15x'},defaultClass:'_1bxxdn15x'}}},bottom:{values:{zero:{conditions:{mobile:'_1bxxdn15y',tablet:'_1bxxdn15z',desktop:'_1bxxdn160'},defaultClass:'_1bxxdn160'},quarter:{conditions:{mobile:'_1bxxdn161',tablet:'_1bxxdn162',desktop:'_1bxxdn163'},defaultClass:'_1bxxdn163'},half:{conditions:{mobile:'_1bxxdn164',tablet:'_1bxxdn165',desktop:'_1bxxdn166'},defaultClass:'_1bxxdn166'},third:{conditions:{mobile:'_1bxxdn167',tablet:'_1bxxdn168',desktop:'_1bxxdn169'},defaultClass:'_1bxxdn169'},full:{conditions:{mobile:'_1bxxdn16a',tablet:'_1bxxdn16b',desktop:'_1bxxdn16c'},defaultClass:'_1bxxdn16c'}}},transform:{values:{translate:{conditions:{mobile:'_1bxxdn16d',tablet:'_1bxxdn16e',desktop:'_1bxxdn16f'},defaultClass:'_1bxxdn16f'},translateX:{conditions:{mobile:'_1bxxdn16g',tablet:'_1bxxdn16h',desktop:'_1bxxdn16i'},defaultClass:'_1bxxdn16i'},translateY:{conditions:{mobile:'_1bxxdn16j',tablet:'_1bxxdn16k',desktop:'_1bxxdn16l'},defaultClass:'_1bxxdn16l'}}},transition:{values:{fast:{conditions:{mobile:'_1bxxdn16m',tablet:'_1bxxdn16n',desktop:'_1bxxdn16o'},defaultClass:'_1bxxdn16o'},medium:{conditions:{mobile:'_1bxxdn16p',tablet:'_1bxxdn16q',desktop:'_1bxxdn16r'},defaultClass:'_1bxxdn16r'},slow:{conditions:{mobile:'_1bxxdn16s',tablet:'_1bxxdn16t',desktop:'_1bxxdn16u'},defaultClass:'_1bxxdn16u'}}},paddingTop:{values:{none:{conditions:{mobile:'_1bxxdn16v',tablet:'_1bxxdn16w',desktop:'_1bxxdn16x'},defaultClass:'_1bxxdn16x'},small:{conditions:{mobile:'_1bxxdn16y',tablet:'_1bxxdn16z',desktop:'_1bxxdn170'},defaultClass:'_1bxxdn170'},medium:{conditions:{mobile:'_1bxxdn171',tablet:'_1bxxdn172',desktop:'_1bxxdn173'},defaultClass:'_1bxxdn173'},large:{conditions:{mobile:'_1bxxdn174',tablet:'_1bxxdn175',desktop:'_1bxxdn176'},defaultClass:'_1bxxdn176'},extraLarge:{conditions:{mobile:'_1bxxdn177',tablet:'_1bxxdn178',desktop:'_1bxxdn179'},defaultClass:'_1bxxdn179'},auto:{conditions:{mobile:'_1bxxdn17a',tablet:'_1bxxdn17b',desktop:'_1bxxdn17c'},defaultClass:'_1bxxdn17c'}}},paddingBottom:{values:{none:{conditions:{mobile:'_1bxxdn17d',tablet:'_1bxxdn17e',desktop:'_1bxxdn17f'},defaultClass:'_1bxxdn17f'},small:{conditions:{mobile:'_1bxxdn17g',tablet:'_1bxxdn17h',desktop:'_1bxxdn17i'},defaultClass:'_1bxxdn17i'},medium:{conditions:{mobile:'_1bxxdn17j',tablet:'_1bxxdn17k',desktop:'_1bxxdn17l'},defaultClass:'_1bxxdn17l'},large:{conditions:{mobile:'_1bxxdn17m',tablet:'_1bxxdn17n',desktop:'_1bxxdn17o'},defaultClass:'_1bxxdn17o'},extraLarge:{conditions:{mobile:'_1bxxdn17p',tablet:'_1bxxdn17q',desktop:'_1bxxdn17r'},defaultClass:'_1bxxdn17r'},auto:{conditions:{mobile:'_1bxxdn17s',tablet:'_1bxxdn17t',desktop:'_1bxxdn17u'},defaultClass:'_1bxxdn17u'}}},paddingLeft:{values:{none:{conditions:{mobile:'_1bxxdn17v',tablet:'_1bxxdn17w',desktop:'_1bxxdn17x'},defaultClass:'_1bxxdn17x'},small:{conditions:{mobile:'_1bxxdn17y',tablet:'_1bxxdn17z',desktop:'_1bxxdn180'},defaultClass:'_1bxxdn180'},medium:{conditions:{mobile:'_1bxxdn181',tablet:'_1bxxdn182',desktop:'_1bxxdn183'},defaultClass:'_1bxxdn183'},large:{conditions:{mobile:'_1bxxdn184',tablet:'_1bxxdn185',desktop:'_1bxxdn186'},defaultClass:'_1bxxdn186'},extraLarge:{conditions:{mobile:'_1bxxdn187',tablet:'_1bxxdn188',desktop:'_1bxxdn189'},defaultClass:'_1bxxdn189'},auto:{conditions:{mobile:'_1bxxdn18a',tablet:'_1bxxdn18b',desktop:'_1bxxdn18c'},defaultClass:'_1bxxdn18c'}}},paddingRight:{values:{none:{conditions:{mobile:'_1bxxdn18d',tablet:'_1bxxdn18e',desktop:'_1bxxdn18f'},defaultClass:'_1bxxdn18f'},small:{conditions:{mobile:'_1bxxdn18g',tablet:'_1bxxdn18h',desktop:'_1bxxdn18i'},defaultClass:'_1bxxdn18i'},medium:{conditions:{mobile:'_1bxxdn18j',tablet:'_1bxxdn18k',desktop:'_1bxxdn18l'},defaultClass:'_1bxxdn18l'},large:{conditions:{mobile:'_1bxxdn18m',tablet:'_1bxxdn18n',desktop:'_1bxxdn18o'},defaultClass:'_1bxxdn18o'},extraLarge:{conditions:{mobile:'_1bxxdn18p',tablet:'_1bxxdn18q',desktop:'_1bxxdn18r'},defaultClass:'_1bxxdn18r'},auto:{conditions:{mobile:'_1bxxdn18s',tablet:'_1bxxdn18t',desktop:'_1bxxdn18u'},defaultClass:'_1bxxdn18u'}}},marginTop:{values:{none:{conditions:{mobile:'_1bxxdn18v',tablet:'_1bxxdn18w',desktop:'_1bxxdn18x'},defaultClass:'_1bxxdn18x'},small:{conditions:{mobile:'_1bxxdn18y',tablet:'_1bxxdn18z',desktop:'_1bxxdn190'},defaultClass:'_1bxxdn190'},medium:{conditions:{mobile:'_1bxxdn191',tablet:'_1bxxdn192',desktop:'_1bxxdn193'},defaultClass:'_1bxxdn193'},large:{conditions:{mobile:'_1bxxdn194',tablet:'_1bxxdn195',desktop:'_1bxxdn196'},defaultClass:'_1bxxdn196'},extraLarge:{conditions:{mobile:'_1bxxdn197',tablet:'_1bxxdn198',desktop:'_1bxxdn199'},defaultClass:'_1bxxdn199'},auto:{conditions:{mobile:'_1bxxdn19a',tablet:'_1bxxdn19b',desktop:'_1bxxdn19c'},defaultClass:'_1bxxdn19c'}}},marginBottom:{values:{none:{conditions:{mobile:'_1bxxdn19d',tablet:'_1bxxdn19e',desktop:'_1bxxdn19f'},defaultClass:'_1bxxdn19f'},small:{conditions:{mobile:'_1bxxdn19g',tablet:'_1bxxdn19h',desktop:'_1bxxdn19i'},defaultClass:'_1bxxdn19i'},medium:{conditions:{mobile:'_1bxxdn19j',tablet:'_1bxxdn19k',desktop:'_1bxxdn19l'},defaultClass:'_1bxxdn19l'},large:{conditions:{mobile:'_1bxxdn19m',tablet:'_1bxxdn19n',desktop:'_1bxxdn19o'},defaultClass:'_1bxxdn19o'},extraLarge:{conditions:{mobile:'_1bxxdn19p',tablet:'_1bxxdn19q',desktop:'_1bxxdn19r'},defaultClass:'_1bxxdn19r'},auto:{conditions:{mobile:'_1bxxdn19s',tablet:'_1bxxdn19t',desktop:'_1bxxdn19u'},defaultClass:'_1bxxdn19u'}}},marginLeft:{values:{none:{conditions:{mobile:'_1bxxdn19v',tablet:'_1bxxdn19w',desktop:'_1bxxdn19x'},defaultClass:'_1bxxdn19x'},small:{conditions:{mobile:'_1bxxdn19y',tablet:'_1bxxdn19z',desktop:'_1bxxdn1a0'},defaultClass:'_1bxxdn1a0'},medium:{conditions:{mobile:'_1bxxdn1a1',tablet:'_1bxxdn1a2',desktop:'_1bxxdn1a3'},defaultClass:'_1bxxdn1a3'},large:{conditions:{mobile:'_1bxxdn1a4',tablet:'_1bxxdn1a5',desktop:'_1bxxdn1a6'},defaultClass:'_1bxxdn1a6'},extraLarge:{conditions:{mobile:'_1bxxdn1a7',tablet:'_1bxxdn1a8',desktop:'_1bxxdn1a9'},defaultClass:'_1bxxdn1a9'},auto:{conditions:{mobile:'_1bxxdn1aa',tablet:'_1bxxdn1ab',desktop:'_1bxxdn1ac'},defaultClass:'_1bxxdn1ac'}}},marginRight:{values:{none:{conditions:{mobile:'_1bxxdn1ad',tablet:'_1bxxdn1ae',desktop:'_1bxxdn1af'},defaultClass:'_1bxxdn1af'},small:{conditions:{mobile:'_1bxxdn1ag',tablet:'_1bxxdn1ah',desktop:'_1bxxdn1ai'},defaultClass:'_1bxxdn1ai'},medium:{conditions:{mobile:'_1bxxdn1aj',tablet:'_1bxxdn1ak',desktop:'_1bxxdn1al'},defaultClass:'_1bxxdn1al'},large:{conditions:{mobile:'_1bxxdn1am',tablet:'_1bxxdn1an',desktop:'_1bxxdn1ao'},defaultClass:'_1bxxdn1ao'},extraLarge:{conditions:{mobile:'_1bxxdn1ap',tablet:'_1bxxdn1aq',desktop:'_1bxxdn1ar'},defaultClass:'_1bxxdn1ar'},auto:{conditions:{mobile:'_1bxxdn1as',tablet:'_1bxxdn1at',desktop:'_1bxxdn1au'},defaultClass:'_1bxxdn1au'}}},fontSize:{values:{small:{conditions:{mobile:'_1bxxdn1bd',tablet:'_1bxxdn1be',desktop:'_1bxxdn1bf'},defaultClass:'_1bxxdn1bf'},medium:{conditions:{mobile:'_1bxxdn1bg',tablet:'_1bxxdn1bh',desktop:'_1bxxdn1bi'},defaultClass:'_1bxxdn1bi'},large:{conditions:{mobile:'_1bxxdn1bj',tablet:'_1bxxdn1bk',desktop:'_1bxxdn1bl'},defaultClass:'_1bxxdn1bl'},extraLarge:{conditions:{mobile:'_1bxxdn1bm',tablet:'_1bxxdn1bn',desktop:'_1bxxdn1bo'},defaultClass:'_1bxxdn1bo'},title:{conditions:{mobile:'_1bxxdn1bp',tablet:'_1bxxdn1bq',desktop:'_1bxxdn1br'},defaultClass:'_1bxxdn1br'}}},fontWeight:{values:{'400':{conditions:{mobile:'_1bxxdn1bs',tablet:'_1bxxdn1bt',desktop:'_1bxxdn1bu'},defaultClass:'_1bxxdn1bu'},'600':{conditions:{mobile:'_1bxxdn1bv',tablet:'_1bxxdn1bw',desktop:'_1bxxdn1bx'},defaultClass:'_1bxxdn1bx'},'700':{conditions:{mobile:'_1bxxdn1by',tablet:'_1bxxdn1bz',desktop:'_1bxxdn1c0'},defaultClass:'_1bxxdn1c0'},'800':{conditions:{mobile:'_1bxxdn1c1',tablet:'_1bxxdn1c2',desktop:'_1bxxdn1c3'},defaultClass:'_1bxxdn1c3'}}},width:{values:{'300':{conditions:{mobile:'_1bxxdn1c4',tablet:'_1bxxdn1c5',desktop:'_1bxxdn1c6'},defaultClass:'_1bxxdn1c6'},'320':{conditions:{mobile:'_1bxxdn1c7',tablet:'_1bxxdn1c8',desktop:'_1bxxdn1c9'},defaultClass:'_1bxxdn1c9'},'420':{conditions:{mobile:'_1bxxdn1ca',tablet:'_1bxxdn1cb',desktop:'_1bxxdn1cc'},defaultClass:'_1bxxdn1cc'},zero:{conditions:{mobile:'_1bxxdn1cd',tablet:'_1bxxdn1ce',desktop:'_1bxxdn1cf'},defaultClass:'_1bxxdn1cf'},quarter:{conditions:{mobile:'_1bxxdn1cg',tablet:'_1bxxdn1ch',desktop:'_1bxxdn1ci'},defaultClass:'_1bxxdn1ci'},half:{conditions:{mobile:'_1bxxdn1cj',tablet:'_1bxxdn1ck',desktop:'_1bxxdn1cl'},defaultClass:'_1bxxdn1cl'},third:{conditions:{mobile:'_1bxxdn1cm',tablet:'_1bxxdn1cn',desktop:'_1bxxdn1co'},defaultClass:'_1bxxdn1co'},full:{conditions:{mobile:'_1bxxdn1cp',tablet:'_1bxxdn1cq',desktop:'_1bxxdn1cr'},defaultClass:'_1bxxdn1cr'},small:{conditions:{mobile:'_1bxxdn1cs',tablet:'_1bxxdn1ct',desktop:'_1bxxdn1cu'},defaultClass:'_1bxxdn1cu'},medium:{conditions:{mobile:'_1bxxdn1cv',tablet:'_1bxxdn1cw',desktop:'_1bxxdn1cx'},defaultClass:'_1bxxdn1cx'},large:{conditions:{mobile:'_1bxxdn1cy',tablet:'_1bxxdn1cz',desktop:'_1bxxdn1d0'},defaultClass:'_1bxxdn1d0'},extraLarge:{conditions:{mobile:'_1bxxdn1d1',tablet:'_1bxxdn1d2',desktop:'_1bxxdn1d3'},defaultClass:'_1bxxdn1d3'},fullLayout:{conditions:{mobile:'_1bxxdn1d4',tablet:'_1bxxdn1d5',desktop:'_1bxxdn1d6'},defaultClass:'_1bxxdn1d6'}}},height:{values:{'300':{conditions:{mobile:'_1bxxdn1d7',tablet:'_1bxxdn1d8',desktop:'_1bxxdn1d9'},defaultClass:'_1bxxdn1d9'},'320':{conditions:{mobile:'_1bxxdn1da',tablet:'_1bxxdn1db',desktop:'_1bxxdn1dc'},defaultClass:'_1bxxdn1dc'},'420':{conditions:{mobile:'_1bxxdn1dd',tablet:'_1bxxdn1de',desktop:'_1bxxdn1df'},defaultClass:'_1bxxdn1df'}}},boxShadow:{values:{thin:{conditions:{mobile:'_1bxxdn1dg',tablet:'_1bxxdn1dh',desktop:'_1bxxdn1di'},defaultClass:'_1bxxdn1di'},small:{conditions:{mobile:'_1bxxdn1dj',tablet:'_1bxxdn1dk',desktop:'_1bxxdn1dl'},defaultClass:'_1bxxdn1dl'},medium:{conditions:{mobile:'_1bxxdn1dm',tablet:'_1bxxdn1dn',desktop:'_1bxxdn1do'},defaultClass:'_1bxxdn1do'},large:{conditions:{mobile:'_1bxxdn1dp',tablet:'_1bxxdn1dq',desktop:'_1bxxdn1dr'},defaultClass:'_1bxxdn1dr'},extraLarge:{conditions:{mobile:'_1bxxdn1ds',tablet:'_1bxxdn1dt',desktop:'_1bxxdn1du'},defaultClass:'_1bxxdn1du'}}},borderRadius:{values:{small:{conditions:{mobile:'_1bxxdn1dv',tablet:'_1bxxdn1dw',desktop:'_1bxxdn1dx'},defaultClass:'_1bxxdn1dx'},medium:{conditions:{mobile:'_1bxxdn1dy',tablet:'_1bxxdn1dz',desktop:'_1bxxdn1e0'},defaultClass:'_1bxxdn1e0'},large:{conditions:{mobile:'_1bxxdn1e1',tablet:'_1bxxdn1e2',desktop:'_1bxxdn1e3'},defaultClass:'_1bxxdn1e3'},extraLarge:{conditions:{mobile:'_1bxxdn1e4',tablet:'_1bxxdn1e5',desktop:'_1bxxdn1e6'},defaultClass:'_1bxxdn1e6'}}},lineHeight:{values:{none:{conditions:{mobile:'_1bxxdn1e7',tablet:'_1bxxdn1e8',desktop:'_1bxxdn1e9'},defaultClass:'_1bxxdn1e9'},tight:{conditions:{mobile:'_1bxxdn1ea',tablet:'_1bxxdn1eb',desktop:'_1bxxdn1ec'},defaultClass:'_1bxxdn1ec'},normal:{conditions:{mobile:'_1bxxdn1ed',tablet:'_1bxxdn1ee',desktop:'_1bxxdn1ef'},defaultClass:'_1bxxdn1ef'},loose:{conditions:{mobile:'_1bxxdn1eg',tablet:'_1bxxdn1eh',desktop:'_1bxxdn1ei'},defaultClass:'_1bxxdn1ei'}}},maxWidth:{values:{zero:{conditions:{mobile:'_1bxxdn1ej',tablet:'_1bxxdn1ek',desktop:'_1bxxdn1el'},defaultClass:'_1bxxdn1el'},quarter:{conditions:{mobile:'_1bxxdn1em',tablet:'_1bxxdn1en',desktop:'_1bxxdn1eo'},defaultClass:'_1bxxdn1eo'},half:{conditions:{mobile:'_1bxxdn1ep',tablet:'_1bxxdn1eq',desktop:'_1bxxdn1er'},defaultClass:'_1bxxdn1er'},third:{conditions:{mobile:'_1bxxdn1es',tablet:'_1bxxdn1et',desktop:'_1bxxdn1eu'},defaultClass:'_1bxxdn1eu'},full:{conditions:{mobile:'_1bxxdn1ev',tablet:'_1bxxdn1ew',desktop:'_1bxxdn1ex'},defaultClass:'_1bxxdn1ex'},small:{conditions:{mobile:'_1bxxdn1ey',tablet:'_1bxxdn1ez',desktop:'_1bxxdn1f0'},defaultClass:'_1bxxdn1f0'},medium:{conditions:{mobile:'_1bxxdn1f1',tablet:'_1bxxdn1f2',desktop:'_1bxxdn1f3'},defaultClass:'_1bxxdn1f3'},large:{conditions:{mobile:'_1bxxdn1f4',tablet:'_1bxxdn1f5',desktop:'_1bxxdn1f6'},defaultClass:'_1bxxdn1f6'},extraLarge:{conditions:{mobile:'_1bxxdn1f7',tablet:'_1bxxdn1f8',desktop:'_1bxxdn1f9'},defaultClass:'_1bxxdn1f9'},fullLayout:{conditions:{mobile:'_1bxxdn1fa',tablet:'_1bxxdn1fb',desktop:'_1bxxdn1fc'},defaultClass:'_1bxxdn1fc'}}},backgroundPosition:{values:{center:{conditions:{mobile:'_1bxxdn1fd',tablet:'_1bxxdn1fe',desktop:'_1bxxdn1ff'},defaultClass:'_1bxxdn1ff'},top:{conditions:{mobile:'_1bxxdn1fg',tablet:'_1bxxdn1fh',desktop:'_1bxxdn1fi'},defaultClass:'_1bxxdn1fi'},bottom:{conditions:{mobile:'_1bxxdn1fj',tablet:'_1bxxdn1fk',desktop:'_1bxxdn1fl'},defaultClass:'_1bxxdn1fl'}}},backgroundSize:{values:{cover:{conditions:{mobile:'_1bxxdn1fm',tablet:'_1bxxdn1fn',desktop:'_1bxxdn1fo'},defaultClass:'_1bxxdn1fo'},contain:{conditions:{mobile:'_1bxxdn1fp',tablet:'_1bxxdn1fq',desktop:'_1bxxdn1fr'},defaultClass:'_1bxxdn1fr'}}},backgroundRepeat:{values:{noRepeat:{conditions:{mobile:'_1bxxdn1fs',tablet:'_1bxxdn1ft',desktop:'_1bxxdn1fu'},defaultClass:'_1bxxdn1fu'},repeat:{conditions:{mobile:'_1bxxdn1fv',tablet:'_1bxxdn1fw',desktop:'_1bxxdn1fx'},defaultClass:'_1bxxdn1fx'},repeatX:{conditions:{mobile:'_1bxxdn1fy',tablet:'_1bxxdn1fz',desktop:'_1bxxdn1g0'},defaultClass:'_1bxxdn1g0'},repeatY:{conditions:{mobile:'_1bxxdn1g1',tablet:'_1bxxdn1g2',desktop:'_1bxxdn1g3'},defaultClass:'_1bxxdn1g3'}}},gridTemplateColumns:{values:{'1':{conditions:{mobile:'_1bxxdn1g4',tablet:'_1bxxdn1g5',desktop:'_1bxxdn1g6'},defaultClass:'_1bxxdn1g6'}}}}},{conditions:undefined,styles:{fontFamily:{values:{body:{defaultClass:'_1bxxdn11r'},title:{defaultClass:'_1bxxdn11s'},subtitle:{defaultClass:'_1bxxdn11t'}}},fontSize:{values:{small:{defaultClass:'_1bxxdn11u'},medium:{defaultClass:'_1bxxdn11v'},large:{defaultClass:'_1bxxdn11w'},extraLarge:{defaultClass:'_1bxxdn11x'},title:{defaultClass:'_1bxxdn11y'}}},fontWeight:{values:{'400':{defaultClass:'_1bxxdn11z'},'600':{defaultClass:'_1bxxdn120'},'700':{defaultClass:'_1bxxdn121'},'800':{defaultClass:'_1bxxdn122'}}},letterSpacing:{values:{tight:{defaultClass:'_1bxxdn123'},normal:{defaultClass:'_1bxxdn124'},wide:{defaultClass:'_1bxxdn125'},widest:{defaultClass:'_1bxxdn126'}}},textAlign:{values:{left:{defaultClass:'_1bxxdn127'},center:{defaultClass:'_1bxxdn128'},right:{defaultClass:'_1bxxdn129'}}}}},{conditions:undefined,styles:{color:{values:{primary:{defaultClass:'_1bxxdn1g7'},secondary:{defaultClass:'_1bxxdn1g8'},tertiary:{defaultClass:'_1bxxdn1g9'},neutral:{defaultClass:'_1bxxdn1ga'}}},backgroundColor:{values:{primary:{defaultClass:'_1bxxdn1gb'},secondary:{defaultClass:'_1bxxdn1gc'},tertiary:{defaultClass:'_1bxxdn1gd'},neutral:{defaultClass:'_1bxxdn1ge'}}}}},{conditions:{defaultCondition:'default',conditionNames:['default','hover','focus'],responsiveArray:undefined},styles:{fontFamily:{values:{body:{conditions:{'default':'_1bxxdn10',hover:'_1bxxdn11',focus:'_1bxxdn12'},defaultClass:'_1bxxdn10'},title:{conditions:{'default':'_1bxxdn13',hover:'_1bxxdn14',focus:'_1bxxdn15'},defaultClass:'_1bxxdn13'},subtitle:{conditions:{'default':'_1bxxdn16',hover:'_1bxxdn17',focus:'_1bxxdn18'},defaultClass:'_1bxxdn16'}}},fontSize:{values:{small:{conditions:{'default':'_1bxxdn19',hover:'_1bxxdn1a',focus:'_1bxxdn1b'},defaultClass:'_1bxxdn19'},medium:{conditions:{'default':'_1bxxdn1c',hover:'_1bxxdn1d',focus:'_1bxxdn1e'},defaultClass:'_1bxxdn1c'},large:{conditions:{'default':'_1bxxdn1f',hover:'_1bxxdn1g',focus:'_1bxxdn1h'},defaultClass:'_1bxxdn1f'},extraLarge:{conditions:{'default':'_1bxxdn1i',hover:'_1bxxdn1j',focus:'_1bxxdn1k'},defaultClass:'_1bxxdn1i'},title:{conditions:{'default':'_1bxxdn1l',hover:'_1bxxdn1m',focus:'_1bxxdn1n'},defaultClass:'_1bxxdn1l'}}},fontWeight:{values:{'400':{conditions:{'default':'_1bxxdn1o',hover:'_1bxxdn1p',focus:'_1bxxdn1q'},defaultClass:'_1bxxdn1o'},'600':{conditions:{'default':'_1bxxdn1r',hover:'_1bxxdn1s',focus:'_1bxxdn1t'},defaultClass:'_1bxxdn1r'},'700':{conditions:{'default':'_1bxxdn1u',hover:'_1bxxdn1v',focus:'_1bxxdn1w'},defaultClass:'_1bxxdn1u'},'800':{conditions:{'default':'_1bxxdn1x',hover:'_1bxxdn1y',focus:'_1bxxdn1z'},defaultClass:'_1bxxdn1x'}}},letterSpacing:{values:{tight:{conditions:{'default':'_1bxxdn110',hover:'_1bxxdn111',focus:'_1bxxdn112'},defaultClass:'_1bxxdn110'},normal:{conditions:{'default':'_1bxxdn113',hover:'_1bxxdn114',focus:'_1bxxdn115'},defaultClass:'_1bxxdn113'},wide:{conditions:{'default':'_1bxxdn116',hover:'_1bxxdn117',focus:'_1bxxdn118'},defaultClass:'_1bxxdn116'},widest:{conditions:{'default':'_1bxxdn119',hover:'_1bxxdn11a',focus:'_1bxxdn11b'},defaultClass:'_1bxxdn119'}}},textAlign:{values:{left:{conditions:{'default':'_1bxxdn11c',hover:'_1bxxdn11d',focus:'_1bxxdn11e'},defaultClass:'_1bxxdn11c'},center:{conditions:{'default':'_1bxxdn11f',hover:'_1bxxdn11g',focus:'_1bxxdn11h'},defaultClass:'_1bxxdn11f'},right:{conditions:{'default':'_1bxxdn11i',hover:'_1bxxdn11j',focus:'_1bxxdn11k'},defaultClass:'_1bxxdn11i'}}},textDecoration:{values:{none:{conditions:{'default':'_1bxxdn11l',hover:'_1bxxdn11m',focus:'_1bxxdn11n'},defaultClass:'_1bxxdn11l'},underline:{conditions:{'default':'_1bxxdn11o',hover:'_1bxxdn11p',focus:'_1bxxdn11q'},defaultClass:'_1bxxdn11o'}}}}});

const Box = createBox({ atoms: valerioSprinkles });

var linkStyles = 'smj4hd1 smj4hd0 _1bxxdn181 _1bxxdn182 _1bxxdn186 _1bxxdn18j _1bxxdn18k _1bxxdn18o _1bxxdn1ga _1bxxdn11l _1bxxdn16o';
var linkActiveStyles = 'smj4hd3 smj4hd2 _1bxxdn1g9 _1bxxdn11o';

const MenuLink = ({ children, href, target = "_self", active = false }) => {
  return /* @__PURE__ */ jsx(Box, { as: "a", "data-astro-prefetch": true, href, target, className: clsx(linkStyles, active && linkActiveStyles), children });
};

var typographyRecipe = createRuntimeFn({defaultClassName:'q7zro06',variantClassNames:{variant:{title:'q7zro07 q7zro00 _1bxxdn13 _1bxxdn1l _1bxxdn1x _1bxxdn194 _1bxxdn195 _1bxxdn196 _1bxxdn1ga',subtitle:'q7zro08 q7zro01 _1bxxdn16 _1bxxdn1f _1bxxdn1r _1bxxdn194 _1bxxdn195 _1bxxdn196 _1bxxdn1ec',description:'q7zro09 q7zro02 _1bxxdn10 _1bxxdn1c _1bxxdn1o _1bxxdn194 _1bxxdn195 _1bxxdn196 _1bxxdn1ef',body:'q7zro0a q7zro03 _1bxxdn10 _1bxxdn1c _1bxxdn19g _1bxxdn19i _1bxxdn19h _1bxxdn1ga',small:'q7zro0b q7zro04 _1bxxdn10 _1bxxdn19 _1bxxdn19i',boxed:'q7zro0c q7zro05 _1bxxdn17y _1bxxdn183 _1bxxdn182 _1bxxdn18g _1bxxdn18l _1bxxdn18k _1bxxdn1gd _1bxxdn1g7'}},defaultVariants:{variant:'body'},compoundVariants:[]});

const variantAs = {
  title: "h1",
  subtitle: "h2",
  body: "p"
};
const Typography = ({ variant, children }) => {
  return /* @__PURE__ */ jsx(Box, { as: variantAs[variant || "span"], className: typographyRecipe({ variant }), children });
};

const SEO = ({ title, description, name, type }) => {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
    /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width" }),
    /* @__PURE__ */ jsx("link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }),
    /* @__PURE__ */ jsx("title", { children: title }),
    /* @__PURE__ */ jsx("meta", { name: "description", content: description }),
    /* @__PURE__ */ jsx("meta", { property: "og:type", content: type }),
    /* @__PURE__ */ jsx("meta", { property: "og:title", content: title }),
    /* @__PURE__ */ jsx("meta", { property: "og:description", content: description }),
    /* @__PURE__ */ jsx("meta", { name: "twitter:creator", content: name }),
    /* @__PURE__ */ jsx("meta", { name: "twitter:card", content: type }),
    /* @__PURE__ */ jsx("meta", { name: "twitter:title", content: title }),
    /* @__PURE__ */ jsx("meta", { name: "twitter:description", content: description })
  ] });
};

const Layout = ({ children, pathname, seo }) => {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  return /* @__PURE__ */ jsxs("html", { lang: "en", className: clsx(defaultTheme), children: [
    /* @__PURE__ */ jsx(
      SEO,
      {
        title: seo?.title || "Valerio Narcisi",
        description: seo?.description || "Valerio Narcisi - Web Developer, Director and Screenwriter",
        name: seo?.name || "Valerio Narcisi",
        type: seo?.type || "website"
      }
    ),
    /* @__PURE__ */ jsxs(Box, { as: "body", children: [
      /* @__PURE__ */ jsxs(Box, { as: "header", className: clsx(headerStyle), children: [
        /* @__PURE__ */ jsx(MenuLink, { href: "/", active: pathname === "/", children: "HOME" }),
        /* @__PURE__ */ jsx(MenuLink, { href: "/about", active: pathname === "/about", children: "About me" })
      ] }),
      /* @__PURE__ */ jsx(Box, { as: "div", className: clsx(layoutStyles), children: /* @__PURE__ */ jsx(
        Box,
        {
          as: "main",
          width: "fullLayout",
          margin: "auto",
          children: /* @__PURE__ */ jsx(
            Box,
            {
              as: "div",
              paddingY: {
                mobile: "large",
                tablet: "extraLarge",
                desktop: "extraLarge"
              },
              children
            }
          )
        }
      ) }),
      /* @__PURE__ */ jsx(
        Box,
        {
          as: "footer",
          backgroundColor: "secondary",
          paddingX: {
            tablet: "extraLarge",
            mobile: "large"
          },
          paddingY: {
            mobile: "medium",
            tablet: "large",
            desktop: "large"
          },
          children: /* @__PURE__ */ jsxs(
            Box,
            {
              width: "extraLarge",
              margin: "auto",
              display: {
                mobile: "flex",
                tablet: "flex",
                desktop: "grid"
              },
              flexDirection: {
                mobile: "column",
                tablet: "column"
              },
              gridTemplateColumns: 1,
              color: "neutral",
              children: [
                /* @__PURE__ */ jsx(Box, { as: "div", children: /* @__PURE__ */ jsxs(Typography, { variant: "description", children: [
                  /* @__PURE__ */ jsx("h3", { children: "Get in touch" }),
                  /* @__PURE__ */ jsxs("ul", { children: [
                    /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://github.com/valerionarcisi", children: "Github" }) }),
                    /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://www.linkedin.com/in/cv-valerio-narcisi/", children: "LinkedIn" }) }),
                    /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://x.com/valerionarcisi", children: "X" }) }),
                    /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://boxd.it/2mFff", children: "Letterboxd" }) })
                  ] })
                ] }) }),
                /* @__PURE__ */ jsxs(Box, { as: "div", children: [
                  /* @__PURE__ */ jsxs(Typography, { variant: "description", children: [
                    /* @__PURE__ */ jsxs("h3", { children: [
                      "This website is made from ",
                      /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://maps.app.goo.gl/U4QDSCMwis5KvoaY8", children: '"Le Marche Zozze"' }),
                      " by me.",
                      /* @__PURE__ */ jsx("br", {}),
                      " Copyright ",
                      currentYear
                    ] }),
                    /* @__PURE__ */ jsx(Typography, { variant: "small", children: "This site uses no tracking or cookies, other than privacy-respecting, GDPR-compliant analytics via Netflify Analytics." })
                  ] }),
                  /* @__PURE__ */ jsx(Box, { marginTop: "large" }),
                  /* @__PURE__ */ jsxs(Typography, { variant: "small", children: [
                    "Made with ",
                    /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://astro.build", children: "Astro" }),
                    ", ",
                    /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://reactjs.org", children: "React" }),
                    ", ",
                    /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://vanilla-extract.style", children: "Vanilla Extract" }),
                    " and hosted on ",
                    /* @__PURE__ */ jsx("a", { target: "_blank", href: "https://www.netlify.com", children: "Netlify" }),
                    "."
                  ] })
                ] })
              ]
            }
          )
        }
      )
    ] })
  ] });
};

const $$Astro$1 = createAstro();
const $$Layout = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Layout;
  const { pathname } = Astro2.url;
  const { seo } = Astro2.props;
  return renderTemplate`<head><meta name="generator"${addAttribute(Astro2.generator, "content")}>${renderHead()}</head> ${renderComponent($$result, "ReactLayout", Layout, { "seo": seo, "pathname": pathname }, { "default": ($$result2) => renderTemplate` ${renderSlot($$result2, $$slots["default"])} ` })}`;
}, "/Users/valerionarcisi/www/valerio-blog/src/layouts/layout.astro", void 0);

const BoxedTitle = ({ children, as: as2 }) => {
  return /* @__PURE__ */ jsx(Box, { as: as2 || "h3", children: /* @__PURE__ */ jsx(Box, { as: "span", className: clsx(typographyRecipe({ variant: "boxed" })), children }) });
};

var tagStyles = 'jd6ygx1 jd6ygx0 _1bxxdn16y _1bxxdn173 _1bxxdn172 _1bxxdn17g _1bxxdn17l _1bxxdn17k _1bxxdn17y _1bxxdn183 _1bxxdn182 _1bxxdn18g _1bxxdn18l _1bxxdn18k _1bxxdn19y _1bxxdn1a3 _1bxxdn1a2 _1bxxdn1ag _1bxxdn1al _1bxxdn1ak _1bxxdn1dv _1bxxdn1dx _1bxxdn1dw _1bxxdn19 _1bxxdn1gd _1bxxdn1ga _1bxxdn11l';

const Tag = ({ label, href }) => {
  return /* @__PURE__ */ jsx(Box, { as: "span", children: /* @__PURE__ */ jsx("a", { className: clsx(tagStyles), href, children: label.toUpperCase() }) });
};

var transitionImg = '_1olb9xz1 _1olb9xz0 _1bxxdn16o';

const Article = ({ post }) => {
  const formattedDate = post?.publishedAt ? new Date(post?.publishedAt).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;
  return /* @__PURE__ */ jsxs(
    Box,
    {
      as: "article",
      display: "grid",
      gridTemplateColumns: 1,
      flexDirection: "row",
      marginBottom: {
        mobile: "extraLarge",
        tablet: "extraLarge",
        desktop: "extraLarge"
      },
      children: [
        /* @__PURE__ */ jsx(Box, { as: "div", children: /* @__PURE__ */ jsx("a", { href: `/post/${post.slug}`, children: /* @__PURE__ */ jsx(
          Box,
          {
            as: "img",
            className: clsx(transitionImg),
            borderRadius: {
              mobile: "small",
              tablet: "medium",
              desktop: "medium"
            },
            boxShadow: {
              mobile: "small",
              tablet: "medium",
              desktop: "medium"
            },
            src: `${post.coverImage.url}`,
            alt: post.title,
            width: "large",
            marginY: {
              mobile: "small",
              tablet: "medium"
            }
          }
        ) }) }),
        /* @__PURE__ */ jsxs(Box, { as: "div", paddingX: "large", children: [
          /* @__PURE__ */ jsx(Box, { as: "h3", marginY: {
            mobile: "small",
            tablet: "medium",
            desktop: "medium"
          }, children: /* @__PURE__ */ jsx("a", { href: `/post/${post.slug}`, children: post.title }) }),
          formattedDate && /* @__PURE__ */ jsxs(Typography, { variant: "small", children: [
            "Posted on ",
            formattedDate
          ] }),
          /* @__PURE__ */ jsxs(Typography, { variant: "small", children: [
            /* @__PURE__ */ jsxs(Box, { as: "i", children: [
              " ",
              post.extract,
              " "
            ] }),
            /* @__PURE__ */ jsx(Box, { as: "a", href: `/post/${post.slug}`, children: "Read more" })
          ] }),
          /* @__PURE__ */ jsx(Box, { as: "div", display: "flex", children: post.tags.map((tag) => /* @__PURE__ */ jsx(Tag, { label: tag, href: `/blog/category/${tag}` }, tag)) })
        ] })
      ]
    },
    post.id
  );
};

const Blog = ({ posts, title }) => {
  return /* @__PURE__ */ jsxs(Box, { as: "section", width: "extraLarge", margin: "auto", children: [
    title && /* @__PURE__ */ jsx(
      Box,
      {
        as: "div",
        display: {
          mobile: "flex",
          desktop: "flex",
          tablet: "flex"
        },
        flexDirection: {
          mobile: "column",
          desktop: "column",
          tablet: "column"
        },
        alignItems: {
          mobile: "center",
          tablet: "center",
          desktop: "center"
        },
        marginTop: {
          mobile: "large",
          tablet: "large",
          desktop: "large"
        },
        children: /* @__PURE__ */ jsx(BoxedTitle, { children: title })
      }
    ),
    /* @__PURE__ */ jsx(Box, { as: "div", width: "extraLarge", margin: "large" }),
    /* @__PURE__ */ jsx(
      Box,
      {
        as: "div",
        display: {
          mobile: "flex",
          desktop: "flex"
        },
        flexDirection: {
          mobile: "column",
          desktop: "column"
        },
        alignItems: {
          mobile: "center",
          desktop: "center"
        },
        children: posts.map((post) => /* @__PURE__ */ jsx(Article, { post }, post.id))
      }
    )
  ] });
};

const fetchHyGraph = async (query) => {
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query
    })
  };
  const response = await fetch("https://api-us-east-1-shared-usea1-02.hygraph.com/v2/clsiqv6af000008l38sai3h9h/master", request);
  const json = await response.json();
  return json;
};

const $$Astro = createAstro();
const $$category = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$category;
  const { category } = Astro2.params;
  const response = await fetchHyGraph(`{
  posts(orderBy: publishedAt_DESC, where: {tags_contains_some: "${category}"}) {
    id
    title
    slug
    publishedAt
    tags
    extract
    createdAt
    coverImage {
      id
      url
      fileName
    }
  }
}
`);
  const posts = response?.data?.posts || [];
  if (posts.length === 0)
    return Astro2.redirect("/404");
  return renderTemplate`${renderComponent($$result, "AstroLayout", $$Layout, { "seo": {
    title: `Category ${category} | Valerio Narcisi | Blog`,
    description: `Category: ${category} of the Valerio Narcisi blog`
  } }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "Blog", Blog, { "posts": posts, "title": `Category: ${category}` })} ` })}`;
}, "/Users/valerionarcisi/www/valerio-blog/src/pages/blog/category/[category].astro", void 0);

const $$file = "/Users/valerionarcisi/www/valerio-blog/src/pages/blog/category/[category].astro";
const $$url = "/blog/category/[category]";

const _category_ = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$category,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

export { $$Layout as $, Article as A, Box as B, Typography as T, _category_ as _, Tag as a, BoxedTitle as b, Blog as c, fetchHyGraph as f, transitionImg as t };
