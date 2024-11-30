#! /usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const scanner = require('i18next-scanner');
const vfs = require('vinyl-fs');

const languagesArg = process.argv[2]; // languages
const resourcesDirPath = process.argv[3]; // resource files dir path
const packagesDirPath = process.argv[4]; // lerna packages dir path
const labelsFilePath = process.argv[5]; // labels file path

const defaultTranslationValue = '__TRANSLATION__';
const tmpDir = './tmp';
const fileExtensions = [
  'js',
  'jsx',
  'ts',
  'tsx',
  'pug',
];

/* eslint-disable-next-line complexity */
const checkArgs = () => {
  try {
    if (!languagesArg) {
      throw new Error('Arg [0]: Languages list is not defined!');
    }

    if (!resourcesDirPath) {
      throw new Error('Arg [1]: Resource files directory path is not defined!');
    }

    if (!packagesDirPath) {
      throw new Error('Arg [2]: Lerna packages directory path is not defined!');
    }
  } catch (error) {
    console.error(error.message);

    process.exit();
  }
};

function customTransform(file, enc, done) {
  const {
    parser,
  } = this;

  const content = fs.readFileSync(
    file.path,
    enc,
  );

  parser.parseFuncFromString(
    content,
    {
      list: ['t'],
    },
    (key) => {
      parser.set(
        key,
        defaultTranslationValue,
      );
    },
  );

  done();
}

const sort = (input) => Object.keys(input).sort().reduce(
  (obj, key) => {
    const uObj = obj;

    uObj[key] = input[key];

    return uObj;
  },
  {
  },
);

const getPackageNames = (dirPath) => fs.readdirSync(dirPath)
  .filter((file) => ['common.json', 'labels.json'].includes(file) === false)
  .map((file) => file.replace(
    '.json',
    '',
  ));

const extractKeys = (filePaths, translationSourceFile) => {
  const options = {
    keySeparator: false,
    resource: {
      savePath: `${translationSourceFile}.json`,
    },
  };

  return new Promise((resolve) => {
    vfs
      .src(filePaths)
      .pipe(scanner(
        options,
        customTransform,
      ))
      .pipe(vfs.dest(tmpDir))
      .on(
        'end',
        () => resolve(),
      );
  });
};

const extractPackagesKeys = async (packageNames) => {
  for (const packageName of packageNames) {
    const filePaths = fileExtensions.map((
      fileExtension,
    ) => `${packagesDirPath}/${packageName}/src/**/*.${fileExtension}`);

    await extractKeys(
      filePaths,
      packageName,
    );
  }
};

const extractLabelsKeys = async (filePath) => {
  await extractKeys(
    [filePath],
    'labels',
  );
};

const getTranslationKeys = async (translationSourceFiles) => {
  const translationKeys = {
  };

  for (const translationSourceFile of translationSourceFiles) {
    const dataFilePath = `${tmpDir}/${translationSourceFile}.json`;
    const dataString = fs.readFileSync(dataFilePath);
    const data = JSON.parse(dataString);

    translationKeys[translationSourceFile] = data;
  }

  return translationKeys;
};

/* eslint-disable-next-line complexity,sonarjs/cognitive-complexity */
const getCommonTranslationKeys = async (translationSourceFiles, rawTranslationKeys) => {
  const translationKeys = rawTranslationKeys;
  const rawCommon = {
  };
  const common = {
  };

  for (const translationSourceFile of translationSourceFiles) {
    for (const [key] of Object.entries(translationKeys[translationSourceFile])) {
      if (rawCommon[key]) {
        rawCommon[key] += 1;
      } else {
        rawCommon[key] = 1;
      }
    }
  }

  for (const [key] of Object.entries(rawCommon)) {
    if (rawCommon[key] > 1) {
      common[key] = defaultTranslationValue;
    }
  }

  for (const translationSourceFile of translationSourceFiles) {
    for (const [key] of Object.entries(common)) {
      if (translationKeys[translationSourceFile][key]) {
        delete translationKeys[translationSourceFile][key];
      }
    }
  }

  translationKeys.common = common;

  return translationKeys;
};

const getTrash = () => {
  const trashPath = `${resourcesDirPath}/trash.json`;
  let trash = {
  };

  if (fs.existsSync(trashPath)) {
    const trashDataString = fs.readFileSync(trashPath);

    const foundTrash = JSON.parse(trashDataString);

    if (foundTrash) {
      trash = foundTrash;
    }
  } else {
    const trashDataString = JSON.stringify(trash);

    fs.writeFileSync(
      trashPath,
      trashDataString,
      'utf8',
    );
  }

  return trash;
};

/* eslint-disable-next-line complexity,sonarjs/cognitive-complexity */
const getTranslations = async (languages, translationKeys) => {
  const translations = {
  };
  const trash = getTrash();

  for (const [translationSourceFile] of Object.entries(translationKeys)) {
    const packageTranslationKeys = translationKeys[translationSourceFile];
    const packageFilePath = `${resourcesDirPath}/${translationSourceFile}.json`;
    const packageDataString = fs.readFileSync(packageFilePath);
    const prevTranslations = JSON.parse(packageDataString) || {
    };

    translations[translationSourceFile] = {
    };

    for (const language of languages) {
      const translation = {
      };

      if (!prevTranslations[language]) {
        prevTranslations[language] = {
          translation: {
          },
        };
      }

      if (!trash[language]) {
        trash[language] = {
        };
      }

      for (const [key] of Object.entries(packageTranslationKeys)) {
        if (prevTranslations[language].translation[key]) {
          translation[key] = prevTranslations[language].translation[key];

          delete prevTranslations[language].translation[key];
        } else {
          translation[key] = defaultTranslationValue;
        }
      }

      translations[translationSourceFile][language] = {
        translation: sort(translation),
      };

      trash[language] = {
        ...trash[language],
        ...prevTranslations[language].translation,
      };
    }
  }

  translations.trash = trash;

  return translations;
};

const saveTranslations = async (translations) => {
  for (const [packageName, data] of Object.entries(translations)) {
    const dataString = JSON.stringify(
      data,
      undefined,
      2,
    );

    fs.writeFileSync(
      `${resourcesDirPath}/${packageName}.json`,
      dataString,
      'utf8',
    );
  }
};

const main = async () => {
  checkArgs();

  const languages = languagesArg.split(',');

  console.info(
    'Languages:',
    languages,
  );

  const packageNames = getPackageNames(resourcesDirPath);

  console.info(
    'Packages:',
    packageNames,
  );

  await extractPackagesKeys(packageNames);

  const translationSourceFiles = packageNames;

  if (labelsFilePath) {
    await extractLabelsKeys(labelsFilePath);

    translationSourceFiles.push('labels');
  }

  const rawTranslationKeys = await getTranslationKeys(translationSourceFiles);

  const translationKeysWithCommon = await getCommonTranslationKeys(
    translationSourceFiles,
    rawTranslationKeys,
  );

  const translations = await getTranslations(
    languages,
    translationKeysWithCommon,
  );

  await saveTranslations(translations);

  fs.rmSync(
    tmpDir,
    {
      force: true,
      recursive: true,
    },
  );
};

main();
